module "audio" {
  source = "../../modules/cloudflare/ishqnama-audio"

  cloudflare_account_id = var.cloudflare_account_id
  bucket_name           = "ishqnama-audio"

  custom_domain = {
    domain  = "audio.ishqnama.com"
    zone_id = data.cloudflare_zone.ishqnama.id
  }

  # The recordings are public and read-only; Range lets the browser seek without fetching the whole file.
  cors_rules = [{
    allowed_origins = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_headers = ["Range"]
    expose_headers  = ["Content-Length", "Content-Range", "Accept-Ranges"]
    max_age_seconds = 86400
  }]
}

# The bucket was created by hand before it was in Terraform; adopt it rather than create a new one.
import {
  to = module.audio.cloudflare_r2_bucket.this
  id = "${var.cloudflare_account_id}/ishqnama-audio/default"
}
