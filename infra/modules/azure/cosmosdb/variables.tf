variable "name" {
  description = "Name of the Cosmos DB account"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for the Cosmos DB account"
  type        = string
}

variable "database_name" {
  description = "Name of the SQL database"
  type        = string
  default     = "ishqnama-userdata"
}

variable "container_name" {
  description = "Name of the SQL container"
  type        = string
  default     = "user-data"
}

variable "partition_key_path" {
  description = "Partition key path for the container"
  type        = string
  default     = "/userId"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
