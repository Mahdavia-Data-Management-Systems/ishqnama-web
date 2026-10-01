terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

# Log Analytics workspace shared by the Container Apps environment (console and system logs) and
# Application Insights (workspace-based telemetry). Both count towards its daily quota.
resource "azurerm_log_analytics_workspace" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.retention_in_days
  # -1 is unlimited
  daily_quota_gb = var.daily_quota_gb
  tags           = var.tags
}
