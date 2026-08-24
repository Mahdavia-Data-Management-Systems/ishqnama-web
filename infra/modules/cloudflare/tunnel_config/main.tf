resource "cloudflare_zero_trust_tunnel_cloudflared_config" "this" {
  account_id = var.cloudflare_account_id
  tunnel_id  = var.tunnel_id

  config {
    ingress_rule {
      hostname = var.domain
      service  = var.service_url
    }

    ingress_rule {
      service = "http_status:404"
    }
  }
}

resource "cloudflare_record" "tunnel" {
  zone_id         = var.zone_id
  name            = "@"
  type            = "CNAME"
  content         = "${var.tunnel_id}.cfargotunnel.com"
  proxied         = true
  allow_overwrite = true
}
