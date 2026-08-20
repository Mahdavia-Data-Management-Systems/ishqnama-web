variable "name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "address_space" {
  type    = list(string)
  default = ["10.0.0.0/16"]
}

variable "aca_subnet_name" {
  type    = string
  default = "snet-aca"
}

variable "aca_subnet_address_prefix" {
  type    = string
  default = "10.0.0.0/23" # /23 minimum for ACA Consumption-only
}

variable "functions_subnet_name" {
  type    = string
  default = "snet-functions"
}

variable "functions_subnet_address_prefix" {
  type    = string
  default = "10.0.2.0/24" # /24 for Function App VNet integration
}

variable "tags" {
  type    = map(string)
  default = {}
}
