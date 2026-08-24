output "zone_id" {
  description = "The zone ID of the created domain"
  value       = cloudflare_zone.this.id
}

output "zone_name_servers" {
  description = "Name servers assigned to the zone"
  value       = cloudflare_zone.this.name_servers
}
