variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "centralindia"
}

# variable "container_registry_server" {
#   description = "Container registry server URL"
#   type        = string
# }

# variable "container_registry_username" {
#   description = "Container registry username"
#   type        = string
# }

# variable "container_registry_password" {
#   description = "Container registry password"
#   type        = string
#   sensitive   = true
# }

# variable "postgres_password" {
#   description = "Password for the PostgreSQL database"
#   type        = string
#   sensitive   = true
# }

locals {
  tags = {
    environment = "dev"
    project     = "ishqnama"
    managed_by  = "terraform"
  }
}
