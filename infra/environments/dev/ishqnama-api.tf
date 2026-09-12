locals {
  api_cors_allowed_origins = [
    "https://dev.ishqnama.com",
    "https://${module.swa.default_host_name}",
    "http://localhost:3000"
  ]

  api_auth_authority = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}/v2.0"

  # Same connection string for both hosts. Becomes a plain SQLite file path once the Quran data is
  # embedded in the image (see plans/dotnet-api-container-apps-plan.md, PR 1).
  quran_db_connection_string = "Host=${module.db.fqdn};Port=5432;Database=ishqnama;Username=postgres;Password=${random_password.postgres.result}"
}

# ---------------------------------------------------------------------------------------------
# Azure Functions host (current production path for the frontend)
# ---------------------------------------------------------------------------------------------

module "functions" {
  source = "../../modules/azure/functions"

  name                 = local.functions_name
  resource_group_name  = azurerm_resource_group.this.name
  location             = azurerm_resource_group.this.location
  storage_account_name = "stishqnamadev"
  tags                 = local.tags

  connection_string = local.quran_db_connection_string

  cors_allowed_origins = local.api_cors_allowed_origins

  app_settings = {
    "CosmosDb__Endpoint"      = module.cosmosdb.endpoint
    "CosmosDb__Key"           = module.cosmosdb.primary_key
    "CosmosDb__DatabaseName"  = module.cosmosdb.database_name
    "CosmosDb__ContainerName" = module.cosmosdb.container_name
    "Auth__ClientId"          = var.entra_api_client_id
    "Auth__TenantId"          = data.tfe_outputs.mdms-core.values.tenant_id
    "Auth__Authority"         = local.api_auth_authority
  }
}

# ---------------------------------------------------------------------------------------------
# Minimal API on Container Apps (Ishqnama.Api). Consumption-only environment, no VNet, scales to
# zero so it stays inside the ACA free grant. Not yet referenced by the frontend.
# ---------------------------------------------------------------------------------------------

module "api_environment" {
  source = "../../modules/azure/aca-environment"

  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  environment_name    = "ishqnama-dev"

  tags = local.tags
}

module "api" {
  source = "../../modules/azure/aca-app"

  resource_group_name          = azurerm_resource_group.this.name
  container_app_environment_id = module.api_environment.id
  container_app_name           = "ca-ishqnama-api-dev"

  # Public image — no registry credentials needed
  containers = [
    {
      name   = "ishqnama-api"
      image  = "docker.io/noormahdi/ishqnama-api:${var.api_image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"
      env = [
        { name = "ASPNETCORE_ENVIRONMENT", value = "Production" },
        { name = "ASPNETCORE_HTTP_PORTS", value = "8080" },
        { name = "ConnectionStrings__QuranDb", secret_name = "quran-db-connection" },
        { name = "CosmosDb__Endpoint", value = module.cosmosdb.endpoint },
        { name = "CosmosDb__Key", secret_name = "cosmosdb-key" },
        { name = "CosmosDb__DatabaseName", value = module.cosmosdb.database_name },
        { name = "CosmosDb__ContainerName", value = module.cosmosdb.container_name },
        { name = "Auth__ClientId", value = var.entra_api_client_id },
        { name = "Auth__Authority", value = local.api_auth_authority },
        # Container Apps has no platform CORS (unlike Functions), so the app must own it
        { name = "Cors__AllowedOrigins", value = join(",", local.api_cors_allowed_origins) }
      ]
      probes = [
        { type = "Startup", transport = "HTTP", port = 8080, path = "/health/ready", interval_seconds = 5, timeout = 3, failure_threshold = 12 },
        { type = "Readiness", transport = "HTTP", port = 8080, path = "/health/ready", interval_seconds = 10, timeout = 3, failure_threshold = 3 },
        { type = "Liveness", transport = "HTTP", port = 8080, path = "/health/live", interval_seconds = 30, timeout = 3, failure_threshold = 3 }
      ]
    }
  ]

  secrets = [
    { name = "quran-db-connection", value = local.quran_db_connection_string },
    { name = "cosmosdb-key", value = module.cosmosdb.primary_key }
  ]

  ingress = {
    external    = true
    target_port = 8080
    transport   = "auto"
  }

  min_replicas = 0
  max_replicas = 1

  tags = local.tags
}
