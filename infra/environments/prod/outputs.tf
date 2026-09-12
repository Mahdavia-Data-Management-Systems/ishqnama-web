output "swa_default_hostname" {
  description = "Default hostname of the Static Web App"
  value       = module.swa.default_host_name
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = module.keyvault.name
}

output "api_fqdn" {
  description = "FQDN of the API Container App (target of the api.ishqnama.com CNAME)"
  value       = module.api.fqdn
}

output "api_url" {
  description = "Base URL of the API Container App (append /api for the routes)"
  value       = module.api.url
}

output "api_custom_domain_verification_id" {
  description = "Value of the asuid.api TXT record required before binding api.ishqnama.com to the Container App. The provider marks it sensitive; read it with terraform output -raw"
  value       = module.api.custom_domain_verification_id
  sensitive   = true
}
