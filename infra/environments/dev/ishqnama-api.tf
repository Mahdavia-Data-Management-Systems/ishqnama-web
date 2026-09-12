locals {
  api_cors_allowed_origins = [
    "https://dev.ishqnama.com",
    "https://${module.swa.default_host_name}",
    "http://localhost:3000"
  ]

  # The frontend calls the API through this custom domain. The hostname, its Cloudflare CNAME to
  # the Container App's FQDN and the Azure managed certificate were added by hand and are not
  # managed here. Container Apps has no path routing, so the /api prefix the SWA appends is just
  # the MapGroup("/api") in the API's Program.cs.
  api_container_app_name = "ca-ishqnama-api-dev"
  api_url                = "https://api.dev.ishqnama.com"

  api_auth_authority = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}/v2.0"

  # The Minimal API talks to the Postgres sidecar in its own replica. Containers in a replica share
  # a network namespace, so the sidecar is reachable on localhost without any ingress.
  api_sidecar_db_connection_string = "Host=localhost;Port=5432;Database=ishqnama;Username=postgres;Password=${random_password.postgres.result}"
}

# Password for the Postgres sidecar, injected as a Container App secret
resource "random_password" "postgres" {
  length  = 32
  special = false
}

# ---------------------------------------------------------------------------------------------
# Minimal API on Container Apps (Ishqnama.Api). Consumption-only environment, no VNet, scales to
# zero so it stays inside the ACA free grant. This is the backend the frontend calls.
#
# The Quran Postgres database runs as a sidecar in the same replica as the API, so it scales to
# zero with it and needs no TCP ingress or VNet, which is what let the always-on standalone
# Postgres app and its VNet-integrated environment be removed.
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
  container_app_name           = local.api_container_app_name

  # The API image is public, but the db sidecar image is private and needs Docker Hub credentials
  container_registry = {
    server   = "docker.io"
    username = var.docker_hub_username
    password = var.docker_hub_password
  }

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
        # Container Apps has no platform CORS, so the app must own it
        { name = "Cors__AllowedOrigins", value = join(",", local.api_cors_allowed_origins) }
      ]
      probes = [
        { type = "Startup", transport = "HTTP", port = 8080, path = "/health/ready", interval_seconds = 5, timeout = 3, failure_threshold = 12 },
        { type = "Readiness", transport = "HTTP", port = 8080, path = "/health/ready", interval_seconds = 10, timeout = 3, failure_threshold = 3 },
        { type = "Liveness", transport = "HTTP", port = 8080, path = "/health/live", interval_seconds = 30, timeout = 3, failure_threshold = 3 }
      ]
    },
    # Postgres sidecar — the Quran database, served over localhost to the API container
    {
      name   = "ishqnama-db"
      image  = "docker.io/noormahdi/ishqnama-db:dev"
      cpu    = 0.25
      memory = "0.5Gi"
      env = [
        { name = "POSTGRES_DB", value = "ishqnama" },
        { name = "POSTGRES_USER", value = "postgres" },
        { name = "POSTGRES_PASSWORD", secret_name = "postgres-password" }
      ]
      probes = [
        # Hold the replica back until Postgres accepts connections so the API's first request doesn't fail
        { type = "Startup", transport = "TCP", port = 5432, interval_seconds = 5, timeout = 3, failure_threshold = 12 },
        { type = "Liveness", transport = "TCP", port = 5432, interval_seconds = 30, timeout = 3, failure_threshold = 3 }
      ]
    }
  ]

  secrets = [
    { name = "quran-db-connection", value = local.api_sidecar_db_connection_string },
    { name = "postgres-password", value = random_password.postgres.result },
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
