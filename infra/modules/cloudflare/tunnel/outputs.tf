output "tunnel_id" {
  description = "The ID of the created tunnel"
  value       = cloudflare_zero_trust_tunnel_cloudflared.this.id
}

output "tunnel_cname" {
  description = "The CNAME value for the tunnel"
  value       = cloudflare_zero_trust_tunnel_cloudflared.this.cname
}

output "tunnel_token" {
  description = "Token used to run the tunnel"
  value       = cloudflare_zero_trust_tunnel_cloudflared.this.tunnel_token
  sensitive   = true
}
