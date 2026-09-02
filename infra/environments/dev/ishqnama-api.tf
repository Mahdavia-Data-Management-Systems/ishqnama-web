module "functions" {
  source = "../../modules/azure/functions"

  name                 = local.functions_name
  resource_group_name  = azurerm_resource_group.this.name
  location             = azurerm_resource_group.this.location
  storage_account_name = "stishqnamadev"
  tags                 = local.tags

  connection_string = "Host=${module.aca.container_app_fqdn};Port=5432;Database=ishqnama;Username=postgres;Password=${random_password.postgres.result}"

  cors_allowed_origins = [
    "https://${module.swa.default_host_name}",
    "http://localhost:3000"
  ]

  app_settings = {
    "CosmosDb__Endpoint"      = module.cosmosdb.endpoint
    "CosmosDb__Key"           = module.cosmosdb.primary_key
    "CosmosDb__DatabaseName"  = module.cosmosdb.database_name
    "CosmosDb__ContainerName" = module.cosmosdb.container_name
    "Auth__ClientId"          = var.entra_api_client_id
    "Auth__TenantId"          = data.tfe_outputs.mdms-core.values.tenant_id
    "Auth__Authority"         = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}/v2.0"
  }
}
