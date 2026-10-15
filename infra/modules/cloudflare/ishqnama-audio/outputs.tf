output "bucket_name" {
  description = "Name of the R2 bucket"
  value       = cloudflare_r2_bucket.this.name
}

output "custom_domain" {
  description = "Public custom domain serving the bucket, or null when none is attached"
  value       = one(cloudflare_r2_custom_domain.this[*].domain)
}
