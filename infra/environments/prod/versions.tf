terraform {
  required_version = ">= 1.5"

  cloud {
    organization = "MDMS"

    workspaces {
      name = "ishqnama-web-prod"
    }
  }

}