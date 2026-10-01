variable "name" {
  description = "Name of the Log Analytics workspace"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "retention_in_days" {
  description = "Retention of the workspace in days"
  type        = number
  default     = 30
}

variable "daily_quota_gb" {
  description = "Daily ingestion quota in GB (-1 for unlimited); ingestion stops for the rest of the UTC day when reached"
  type        = number
  default     = -1
}

variable "tags" {
  description = "Tags to apply to the resource"
  type        = map(string)
  default     = {}
}
