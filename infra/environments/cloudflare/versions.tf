terraform {
  required_version = ">= 1.6"

  cloud {
    organization = "MDMS"

    workspaces {
      name = "ishqnama-web-cloudflare"
    }
  }
}