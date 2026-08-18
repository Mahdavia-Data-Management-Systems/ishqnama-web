resource "azurerm_resource_group" "this" {
  name     = "rg-ishqnama-prod"
  location = var.location
  tags     = local.tags
}