resource "cloudflare_r2_bucket" "this" {
  account_id    = var.cloudflare_account_id
  name          = var.bucket_name
  location      = var.location
  storage_class = var.storage_class
}

resource "cloudflare_r2_custom_domain" "this" {
  count = var.custom_domain == null ? 0 : 1

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.this.name
  domain      = var.custom_domain.domain
  zone_id     = var.custom_domain.zone_id
  min_tls     = var.custom_domain.min_tls
  enabled     = true
}

resource "cloudflare_r2_bucket_cors" "this" {
  count = length(var.cors_rules) == 0 ? 0 : 1

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.this.name
  rules = [for rule in var.cors_rules : {
    allowed = {
      origins = rule.allowed_origins
      methods = rule.allowed_methods
      headers = rule.allowed_headers
    }
    expose_headers  = rule.expose_headers
    max_age_seconds = rule.max_age_seconds
  }]
}
