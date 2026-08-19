resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-prod"
  location = var.location
  tags     = local.tags
}

module "keyvault" {
  source = "../../modules/keyvault"

  name                = "kv-ishqnama-prod"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

module "swa" {
  source = "../../modules/swa"

  name                = "swa-ishqnama-prod"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.swa_location
  tags                = local.tags
}

resource "azurerm_key_vault_secret" "swa_deployment_token" {
  name         = "swa-deployment-token"
  value        = module.swa.api_key
  key_vault_id = module.keyvault.id
}