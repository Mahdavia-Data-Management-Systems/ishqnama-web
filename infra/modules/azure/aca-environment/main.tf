terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.environment_name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_in_days
  tags                = var.tags
}

resource "azurerm_container_app_environment" "this" {
  name                       = var.environment_name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  infrastructure_subnet_id   = var.infrastructure_subnet_id
  public_network_access      = var.public_network_access
  tags                       = var.tags

  # Workload profiles only apply to VNet-integrated environments. Without a subnet this is a
  # Consumption-only environment, which is what a scale-to-zero HTTP app needs.
  dynamic "workload_profile" {
    for_each = var.infrastructure_subnet_id != null ? var.workload_profiles : []
    content {
      name                  = workload_profile.value.name
      workload_profile_type = workload_profile.value.workload_profile_type
    }
  }
}
