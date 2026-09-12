variable "azure_subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "centralindia"
}

variable "swa_location" {
  description = "Azure region for Static Web App (may differ from main location)"
  type        = string
  default     = "eastasia"
}

variable "docker_hub_username" {
  description = "Docker Hub username"
  type        = string
}

variable "docker_hub_password" {
  description = "Docker Hub password/token"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "api_image_tag" {
  description = "Tag of the docker.io/noormahdi/ishqnama-api image deployed to the API Container App"
  type        = string
  default     = "dev"
}

variable "entra_api_client_id" {
  description = "Entra ID app registration client ID for the backend API"
  type        = string
  default     = "fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83"
}

locals {
  tags = {
    environment = "dev"
    project     = "ishqnama"
    managed_by  = "terraform"
  }
}
