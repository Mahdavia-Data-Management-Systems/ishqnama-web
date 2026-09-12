output "id" {
  description = "ID of the Container Apps environment"
  value       = azurerm_container_app_environment.this.id
}

output "name" {
  description = "Name of the Container Apps environment"
  value       = azurerm_container_app_environment.this.name
}

output "default_domain" {
  description = "Default domain of the Container Apps environment"
  value       = azurerm_container_app_environment.this.default_domain
}

output "static_ip_address" {
  description = "Static IP of the environment (VNet-integrated environments only)"
  value       = azurerm_container_app_environment.this.static_ip_address
}

output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.id
}
