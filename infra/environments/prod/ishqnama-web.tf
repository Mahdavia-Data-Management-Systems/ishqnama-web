locals {
  # Hostnames the frontend is served from. The apex and www custom domains on the SWA are added by
  # hand (Cloudflare DNS-only records plus the SWA domain validation) and are not managed here.
  web_hostnames = ["ishqnama.com", "www.ishqnama.com", "preview.ishqnama.com"]
}

module "swa" {
  source = "../../modules/azure/swa"

  name                = "swa-ishqnama-prod"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.swa_location
  tags                = local.tags

  app_settings = {
    NEXT_PUBLIC_ENTRA_AUTHORITY = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}"
    NEXT_PUBLIC_ENTRA_CLIENT_ID = var.entra_spa_client_id
    NEXT_PUBLIC_ENTRA_API_SCOPE = "api://${var.entra_api_client_id}/access_as_user"
    # Minimal API on Container Apps. Read by deploy-frontend.yml at build time, so a change here
    # takes effect on the next frontend deploy (prod-release.yml runs it after infra).
    NEXT_PUBLIC_API_URL = "${local.api_url}/api"
  }
}

resource "azurerm_key_vault_secret" "swa_deployment_token" {
  name         = "swa-deployment-token"
  value        = module.swa.api_key
  key_vault_id = module.keyvault.id
}
