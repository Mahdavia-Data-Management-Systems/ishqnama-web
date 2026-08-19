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
}

resource "azapi_resource_action" "swa_appsettings" {
  type        = "Microsoft.Web/staticSites/config@2024-04-01"
  resource_id = "${module.swa.id}/config/appsettings"
  method      = "PUT"

  body = {
    properties = {
      NEXT_PUBLIC_ENTRA_AUTHORITY    = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}"
      NEXT_PUBLIC_ENTRA_CLIENT_ID    = data.tfe_outputs.apps-dev.values.apps["ishqnama-spa"].app_id
      NEXT_PUBLIC_ENTRA_REDIRECT_URI = "https://${module.swa.default_host_name}"
    }
  }
}

resource "azurerm_key_vault_secret" "swa_deployment_token" {
  name         = "swa-deployment-token"
  value        = module.swa.api_key
  key_vault_id = module.keyvault.id
}


# module "aca" {
#   source = "../../modules/aca"

#   resource_group_name = azurerm_resource_group.this.name
#   location            = azurerm_resource_group.this.location
#   environment_name    = "ishqnama-dev"
#   container_app_name  = "ishqnama-dev"

#   container_registry = {
#     server   = var.container_registry_server
#     username = var.container_registry_username
#     password = var.container_registry_password
#   }

#   secrets = [
#     {
#       name  = "postgres-password"
#       value = var.postgres_password
#     }
#   ]

#   volumes = [
#     {
#       name         = "pg-data"
#       storage_type = "EmptyDir"
#     }
#   ]

#   containers = [
#     {
#       name   = "api"
#       image  = "${var.container_registry_server}/ishqnama-api:dev"
#       cpu    = 0.25
#       memory = "0.5Gi"
#       env = [
#         {
#           name  = "ASPNETCORE_URLS"
#           value = "http://+:8000"
#         },
#         {
#           name  = "ConnectionStrings__QuranDb"
#           value = "Host=localhost;Port=5432;Database=ishqnama;Username=postgres;Password=${var.postgres_password}"
#         }
#       ]
#       ports = [{ port = 8000 }]
#       probes = [
#         {
#           type      = "Startup"
#           transport = "HTTP"
#           port      = 8000
#           path      = "/healthz"
#           interval_seconds  = 5
#           timeout           = 2
#           failure_threshold = 10
#           initial_delay     = 5
#         },
#         {
#           type      = "Liveness"
#           transport = "HTTP"
#           port      = 8000
#           path      = "/healthz"
#           interval_seconds  = 30
#           timeout           = 2
#           failure_threshold = 3
#           initial_delay     = 0
#         }
#       ]
#     },
#     {
#       name   = "db"
#       image  = "${var.container_registry_server}/ishqnama-db:dev"
#       cpu    = 0.25
#       memory = "0.5Gi"
#       env = [
#         {
#           name  = "POSTGRES_DB"
#           value = "ishqnama"
#         },
#         {
#           name  = "POSTGRES_USER"
#           value = "postgres"
#         },
#         {
#           name        = "POSTGRES_PASSWORD"
#           secret_name = "postgres-password"
#         }
#       ]
#       ports = [{ port = 5432 }]
#       probes = [
#         {
#           type      = "Startup"
#           transport = "TCP"
#           port      = 5432
#           interval_seconds  = 5
#           timeout           = 2
#           failure_threshold = 10
#           initial_delay     = 10
#         },
#         {
#           type      = "Liveness"
#           transport = "TCP"
#           port      = 5432
#           interval_seconds  = 30
#           timeout           = 2
#           failure_threshold = 3
#           initial_delay     = 0
#         }
#       ]
#       volume_mounts = [
#         {
#           name = "pg-data"
#           path = "/var/lib/postgresql/data"
#         }
#       ]
#     }
#   ]

#   ingress = {
#     external    = true
#     target_port = 8000
#   }

#   min_replicas = 0
#   max_replicas = 1

#   tags = local.tags
# }
