variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
}

variable "environment_name" {
  description = "Name of the Container Apps environment (the Log Analytics workspace is named '<environment_name>-logs')"
  type        = string
}

variable "public_network_access" {
  description = "Whether the environment is accessible from public networks"
  type        = string
  default     = "Enabled"

  validation {
    condition     = contains(["Enabled", "Disabled"], var.public_network_access)
    error_message = "public_network_access must be 'Enabled' or 'Disabled'."
  }
}

variable "infrastructure_subnet_id" {
  description = "Subnet ID for VNet integration (required for TCP ingress / workload profiles). Leave null for a Consumption-only environment."
  type        = string
  default     = null
}

variable "workload_profiles" {
  description = "Workload profiles for the environment (only used when infrastructure_subnet_id is set)"
  type = list(object({
    name                  = string
    workload_profile_type = string
  }))
  default = [
    {
      name                  = "Consumption"
      workload_profile_type = "Consumption"
    }
  ]
}

variable "log_retention_in_days" {
  description = "Retention of the Log Analytics workspace in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
