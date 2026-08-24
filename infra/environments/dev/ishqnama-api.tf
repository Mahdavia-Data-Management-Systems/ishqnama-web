module "functions" {
  source = "../../modules/azure/functions"

  name                 = "func-ishqnama-dev"
  resource_group_name  = azurerm_resource_group.this.name
  location             = azurerm_resource_group.this.location
  storage_account_name = "stishqnamadev"
  tags                 = local.tags

  connection_string = "Host=${module.aca.container_app_fqdn};Port=5432;Database=ishqnama;Username=postgres;Password=${random_password.postgres.result}"

  cors_allowed_origins = [
    "https://${module.swa.default_host_name}",
    "http://localhost:3000"
  ]
}