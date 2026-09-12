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

variable "mdms_core_workspace" {
  description = "Terraform Cloud workspace in the MDMS organization whose outputs (tenant_domain, tenant_id) describe the Entra External ID tenant used for sign-in"
  type        = string
  default     = "core-prod"
}

variable "api_image_tag" {
  description = "Tag of the docker.io/noormahdi/ishqnama-api image deployed to the API Container App. prod-release.yml passes the CI-built version it promotes; latest is only a fallback for manual runs"
  type        = string
  default     = "latest"
}

variable "db_image_tag" {
  description = "Tag of the docker.io/noormahdi/ishqnama-db image run as the Postgres sidecar. Container Apps never re-pulls a re-pushed tag, so a new revision needs a new value"
  type        = string
  default     = "latest"
}

variable "entra_spa_client_id" {
  description = "Entra ID app registration client ID for the frontend SPA (its redirect URIs must include the prod hostnames)"
  type        = string
  default     = "127f0236-2b16-4f7a-9394-9a27a5fc20d2"
}

variable "entra_api_client_id" {
  description = "Entra ID app registration client ID for the backend API"
  type        = string
  default     = "fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83"
}

locals {
  tags = {
    environment = "prod"
    project     = "ishqnama"
    managed_by  = "terraform"
  }
}
