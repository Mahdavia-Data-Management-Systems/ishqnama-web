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
  value       = module.aca.container_app_fqdn
}
