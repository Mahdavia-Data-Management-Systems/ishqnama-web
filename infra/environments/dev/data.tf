data "tfe_outputs" "mdms-core" {
  organization = "MDMS"
  workspace    = "core-dev"
}

data "tfe_outputs" "apps-dev" {
  organization = "MDMS"
  workspace    = "apps-dev"
}
