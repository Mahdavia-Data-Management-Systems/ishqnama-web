resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-dev"
  location = var.location
  tags     = local.tags
}

module "keyvault" {
  source = "../../modules/azure/keyvault"

  name                = "kv-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

module "tunnel" {
  source = "../../modules/cloudflare/tunnel"

  cloudflare_account_id = var.cloudflare_account_id
  tunnel_name           = "ishqnama-dev"
}

resource "azurerm_key_vault_secret" "cf_tunnel_token" {
  name         = "cf-tunnel-token"
  value        = module.tunnel.tunnel_token
  key_vault_id = module.keyvault.id
}

module "tunnel_config" {
  source = "../../modules/cloudflare/tunnel_config"

  cloudflare_account_id = var.cloudflare_account_id
  zone_id               = data.cloudflare_zone.ishqnama.id
  tunnel_id             = module.tunnel.tunnel_id
  domain                = "dev.ishqnama.com"
  service_url           = "http://localhost:8080"
}

