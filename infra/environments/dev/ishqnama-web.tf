module "swa" {
  source = "../../modules/azure/swa"

  name                = "swa-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.swa_location
  tags                = local.tags

  app_settings = {
    NEXT_PUBLIC_ENTRA_AUTHORITY = "https://${split(".", data.tfe_outputs.mdms-core.values.tenant_domain)[0]}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}"
    NEXT_PUBLIC_ENTRA_CLIENT_ID = "127f0236-2b16-4f7a-9394-9a27a5fc20d2"
    NEXT_PUBLIC_ENTRA_API_SCOPE = "api://${var.entra_api_client_id}/access_as_user"
    # Minimal API on Container Apps. Read by deploy-frontend.yml at build time, so a change here
    # takes effect on the next frontend deploy (ci.yml runs it after infra).
    NEXT_PUBLIC_API_URL = "${local.api_url}/api"
    # Origin that link previews (og:image, og:url) are built from; crawlers need absolute URLs.
    NEXT_PUBLIC_SITE_URL = "https://dev.ishqnama.com"
  }
}

resource "azurerm_key_vault_secret" "swa_deployment_token" {
  name         = "swa-deployment-token"
  value        = module.swa.api_key
  key_vault_id = module.keyvault.id
}