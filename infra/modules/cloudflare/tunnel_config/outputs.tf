output "dns_record_id" {
  description = "The ID of the DNS record pointing to the tunnel"
  value       = cloudflare_record.tunnel.id
}
