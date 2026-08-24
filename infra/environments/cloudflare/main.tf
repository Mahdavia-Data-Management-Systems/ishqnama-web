module "ishqnama" {
  source = "../../modules/cloudflare/zone"

  cloudflare_account_id = var.cloudflare_account_id
  domain                = "ishqnama.com"
}