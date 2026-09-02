output "endpoint" {
  description = "The endpoint URI of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.endpoint
}

output "primary_key" {
  description = "The primary key for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.primary_key
  sensitive   = true
}

output "connection_string" {
  description = "The primary connection string for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.primary_sql_connection_string
  sensitive   = true
}

output "database_name" {
  description = "The name of the SQL database"
  value       = azurerm_cosmosdb_sql_database.this.name
}

output "container_name" {
  description = "The name of the SQL container"
  value       = azurerm_cosmosdb_sql_container.this.name
}
