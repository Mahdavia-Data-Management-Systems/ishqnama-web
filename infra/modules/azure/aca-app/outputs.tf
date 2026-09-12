output "id" {
  description = "ID of the Container App"
  value       = azurerm_container_app.this.id
}

output "name" {
  description = "Name of the Container App"
  value       = azurerm_container_app.this.name
}

output "fqdn" {
  description = "FQDN of the Container App (available when ingress is configured)"
  value       = try(azurerm_container_app.this.ingress[0].fqdn, null)
}

output "url" {
  description = "URL of the Container App (available when ingress is configured)"
  value       = try("https://${azurerm_container_app.this.ingress[0].fqdn}", null)
}

output "latest_revision_name" {
  description = "Name of the latest revision"
  value       = azurerm_container_app.this.latest_revision_name
}

output "custom_domain_verification_id" {
  description = "Verification ID for binding a custom domain (asuid TXT record value)"
  value       = azurerm_container_app.this.custom_domain_verification_id
}

output "identity_principal_id" {
  description = "Principal ID of the system-assigned identity, if enabled"
  value       = try(azurerm_container_app.this.identity[0].principal_id, null)
}
