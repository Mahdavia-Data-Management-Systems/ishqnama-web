resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-dev"
  location = var.location
  tags     = local.tags
}

module "keyvault" {
  source = "../../modules/azure/keyvault"

  name                = "kv-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

module "swa" {
  source = "../../modules/azure/swa"

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

module "tunnel" {
  source = "../../modules/cloudflare/tunnel"

  cloudflare_account_id = var.cloudflare_account_id
  tunnel_name           = "ishqnama-dev"
}

resource "azurerm_key_vault_secret" "cf_tunnel_token" {
  name         = "cf-tunnel-token"
  value        = module.tunnel.tunnel_token
  key_vault_id = module.keyvault.id
}

module "tunnel_config" {
  source = "../../modules/cloudflare/tunnel_config"

  cloudflare_account_id = var.cloudflare_account_id
  zone_id               = module.ishqnama.zone_id
  tunnel_id             = module.tunnel.tunnel_id
  domain                = "dev.ishqnama.com"
  service_url           = "http://localhost:8080"
}

resource "azurerm_virtual_network" "this" {
  name                = "vnet-ishqnama-dev"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  address_space       = ["10.0.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "aca" {
  name                 = "snet-aca"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["10.0.0.0/23"]

  delegation {
    name = "aca"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

module "aca" {
  source = "../../modules/azure/aca"

  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  environment_name         = "ishqnama-db-dev"
  container_app_name       = "ishqnama-db-dev"
  infrastructure_subnet_id = azurerm_subnet.aca.id

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
    external     = true
    target_port  = 5432
    exposed_port = 5432
    transport    = "tcp"
  }

  min_replicas = 1
  max_replicas = 1

  tags = local.tags
}

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
