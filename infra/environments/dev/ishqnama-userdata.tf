module "cosmosdb" {
  source = "../../modules/azure/cosmosdb"

  name                = "cosmos-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

resource "azurerm_key_vault_secret" "cosmosdb_key" {
  name         = "cosmosdb-primary-key"
  value        = module.cosmosdb.primary_key
  key_vault_id = module.keyvault.id
}
