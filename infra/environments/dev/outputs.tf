output "swa_default_hostname" {
  description = "Default hostname of the Static Web App"
  value       = module.swa.default_host_name
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = module.keyvault.name
}

output "function_app_name" {
  description = "Name of the Function App"
  value       = module.functions.name
}

output "api_fqdn" {
  description = "FQDN of the API Container App"
  value       = module.api.fqdn
}

output "api_url" {
  description = "Base URL of the API (append /api for the routes)"
  value       = local.api_url
}

output "api_container_app_name" {
  description = "Name of the API Container App"
  value       = module.api.name
}

output "api_environment_name" {
  description = "Name of the Container Apps environment the API runs in"
  value       = module.api_environment.name
}

output "api_custom_domain" {
  description = "Custom hostname bound to the API Container App; deploy-infra.yml binds its managed certificate"
  value       = azurerm_container_app_custom_domain.api.name
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.this.name
}
