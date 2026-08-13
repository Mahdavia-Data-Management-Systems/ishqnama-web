terraform {
  required_version = ">= 1.5"

  cloud {
    organization = "MDMS"

    workspaces {
      name = "ishqnama-web-dev"
    }
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id = var.azure_subscription_id
}