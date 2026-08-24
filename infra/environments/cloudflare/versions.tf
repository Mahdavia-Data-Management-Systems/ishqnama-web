terraform {
  required_version = ">= 1.0"

  cloud {
    organization = "MDMS"

    workspaces {
      name = "ishqnama-web-cloudflare"
    }
  }
}