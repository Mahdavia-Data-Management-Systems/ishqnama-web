output "id" {
  description = "ID of the Application Insights resource"
  value       = azurerm_application_insights.this.id
}

output "app_id" {
  description = "Application ID of the Application Insights resource"
  value       = azurerm_application_insights.this.app_id
}

output "connection_string" {
  description = "Connection string for the SDKs (also shipped in the public frontend bundle)"
  value       = azurerm_application_insights.this.connection_string
  sensitive   = true
}
