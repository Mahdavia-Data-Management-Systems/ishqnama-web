output "id" {
  description = "ID of the Function App"
  value       = azurerm_linux_function_app.this.id
}

output "name" {
  description = "Name of the Function App"
  value       = azurerm_linux_function_app.this.name
}

output "default_hostname" {
  description = "Default hostname of the Function App"
  value       = azurerm_linux_function_app.this.default_hostname
}
