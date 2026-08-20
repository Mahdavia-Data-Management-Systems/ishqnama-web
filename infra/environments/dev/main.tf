resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-dev"
  location = var.location
  tags     = local.tags
}

module "keyvault" {
  source = "../../modules/keyvault"

  name                = "kv-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

module "swa" {
  source = "../../modules/swa"

  name                = "swa-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.swa_location
  tags                = local.tags

  app_settings = {
    NEXT_PUBLIC_ENTRA_AUTHORITY = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}"
    NEXT_PUBLIC_ENTRA_CLIENT_ID = data.tfe_outputs.apps-dev.values.apps["ishqnama-spa"].app_id
  }
}

resource "azurerm_key_vault_secret" "swa_deployment_token" {
  name         = "swa-deployment-token"
  value        = module.swa.api_key
  key_vault_id = module.keyvault.id
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "postgres-password"
  value        = random_password.postgres.result
  key_vault_id = module.keyvault.id
}

module "network" {
  source = "../../modules/network"

  name                = "vnet-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

module "aca" {
  source = "../../modules/aca"

  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  environment_name    = "ishqnama-db-dev"
  container_app_name  = "ishqnama-db-dev"

  infrastructure_subnet_id       = module.network.aca_subnet_id
  internal_load_balancer_enabled = true

  container_registry = {
    server   = "docker.io"
    username = var.docker_hub_username
    password = var.docker_hub_password
  }

  containers = [
    {
      name   = "db"
      image  = "docker.io/noormahdi/ishqnama-db:dev"
      cpu    = 0.25
      memory = "0.5Gi"
      env = [
        { name = "POSTGRES_DB", value = "ishqnama" },
        { name = "POSTGRES_USER", value = "postgres" },
        { name = "POSTGRES_PASSWORD", secret_name = "postgres-password" }
      ]
    }
  ]

  secrets = [
    { name = "postgres-password", value = random_password.postgres.result }
  ]

  ingress = {
    external     = false
    target_port  = 5432
    exposed_port = 5432
    transport    = "tcp"
  }

  min_replicas = 0
  max_replicas = 1

  tags = local.tags
}

module "functions" {
  source = "../../modules/functions"

  name                 = "func-ishqnama-dev"
  resource_group_name  = azurerm_resource_group.this.name
  location             = azurerm_resource_group.this.location
  storage_account_name = "stishqnamadev"
  tags                 = local.tags

  virtual_network_subnet_id = module.network.functions_subnet_id

  connection_string = "Host=${module.aca.container_app_fqdn};Port=5432;Database=ishqnama;Username=postgres;Password=${random_password.postgres.result}"

  cors_allowed_origins = [
    "https://${module.swa.default_host_name}",
    "http://localhost:3000"
  ]
}
