output "environment_id" {
  description = "ID of the Container Apps environment"
  value       = azurerm_container_app_environment.this.id
}

output "environment_default_domain" {
  description = "Default domain of the Container Apps environment"
  value       = azurerm_container_app_environment.this.default_domain
}

output "container_app_id" {
  description = "ID of the Container App"
  value       = azurerm_container_app.this.id
}

output "container_app_fqdn" {
  description = "FQDN of the Container App (available when ingress is configured)"
  value       = try(azurerm_container_app.this.ingress[0].fqdn, null)
}

output "container_app_url" {
  description = "URL of the Container App (available when ingress is configured)"
  value       = try("https://${azurerm_container_app.this.ingress[0].fqdn}", null)
}

output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.id
}
