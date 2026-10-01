terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

# Workspace-based Application Insights: telemetry lands in the given Log Analytics workspace, so it
# shares that workspace's retention, daily quota and free monthly allowance.
resource "azurerm_application_insights" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = var.workspace_id
  application_type    = "web"
  retention_in_days   = var.retention_in_days

  # Hard stop on ingestion for the rest of the UTC day once the cap is reached. The connection
  # string ships in the public frontend bundle, so this cap (with the workspace quota) is what
  # keeps a flood of telemetry from costing anything.
  daily_data_cap_in_gb                 = var.daily_data_cap_in_gb
  daily_data_cap_notifications_enabled = true

  # The browser ingests with the connection string; an anonymous reader cannot use Entra auth
  internet_ingestion_enabled   = true
  internet_query_enabled       = true
  local_authentication_enabled = true

  tags = var.tags
}
