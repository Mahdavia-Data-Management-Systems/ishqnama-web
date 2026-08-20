variable "name" {
  description = "Name of the Function App"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
}

variable "storage_account_name" {
  description = "Name of the storage account for the Function App"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Must be 3-24 lowercase alphanumeric characters."
  }
}

variable "connection_string" {
  description = "Database connection string"
  type        = string
  sensitive   = true
}

variable "cors_allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = []
}

variable "app_settings" {
  description = "Additional app settings for the Function App"
  type        = map(string)
  default     = {}
}

variable "virtual_network_subnet_id" {
  description = "Subnet ID for Function App VNet integration (outbound traffic)"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
