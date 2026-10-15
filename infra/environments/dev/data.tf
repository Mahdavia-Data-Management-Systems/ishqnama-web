data "tfe_outputs" "mdms-core" {
  organization = "MDMS"
  workspace    = "core-dev"
}

data "cloudflare_zone" "ishqnama" {
  filter = {
    name = "ishqnama.com"
  }
}