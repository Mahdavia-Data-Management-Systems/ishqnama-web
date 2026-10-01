variable "name" {
  description = "Name of the Application Insights resource"
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

variable "workspace_id" {
  description = "ID of the Log Analytics workspace the telemetry is stored in"
  type        = string
}

variable "retention_in_days" {
  description = "Retention of the telemetry in days (match the workspace)"
  type        = number
  default     = 30
}

variable "daily_data_cap_in_gb" {
  description = "Daily ingestion cap in GB; ingestion stops for the rest of the UTC day when reached"
  type        = number
}

variable "tags" {
  description = "Tags to apply to the resource"
  type        = map(string)
  default     = {}
}
