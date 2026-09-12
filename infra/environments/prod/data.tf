# Entra External ID (CIAM) tenant details, published by the MDMS core workspace
data "tfe_outputs" "mdms-core" {
  organization = "MDMS"
  workspace    = var.mdms_core_workspace
}

data "cloudflare_zone" "ishqnama" {
  name = "ishqnama.com"
}
