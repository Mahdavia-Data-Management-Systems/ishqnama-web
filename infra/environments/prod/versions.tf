terraform {
  required_version = ">= 1.5"

  cloud {
    organization = "MDMS"

    workspaces {
      name = "ishqnama-web-prod"
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
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }

  subscription_id = var.azure_subscription_id
}