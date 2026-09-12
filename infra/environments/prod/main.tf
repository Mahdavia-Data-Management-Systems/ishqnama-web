resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-prod"
  location = var.location
  tags     = local.tags
}

module "keyvault" {
  source = "../../modules/azure/keyvault"

  name                = "kv-ishqnama-prod"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}
