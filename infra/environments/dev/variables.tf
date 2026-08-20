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

locals {
  tags = {
    environment = "dev"
    project     = "ishqnama"
    managed_by  = "terraform"
  }
}
