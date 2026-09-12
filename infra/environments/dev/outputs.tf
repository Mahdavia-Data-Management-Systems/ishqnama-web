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

output "db_fqdn" {
  description = "FQDN of the database Container App"
  value       = module.db.fqdn
}

output "api_fqdn" {
  description = "FQDN of the API Container App"
  value       = module.api.fqdn
}

output "api_url" {
  description = "Base URL of the API Container App (append /api for the routes)"
  value       = module.api.url
}
