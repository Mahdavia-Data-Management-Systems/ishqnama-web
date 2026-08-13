resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-dev"
  location = var.location
  tags     = local.tags
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
#       image  = "${var.container_registry_server}/ishqnama-api:latest"
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
#       image  = "${var.container_registry_server}/ishqnama-db:latest"
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
