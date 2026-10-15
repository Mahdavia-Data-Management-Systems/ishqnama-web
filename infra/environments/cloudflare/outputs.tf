output "audio_bucket_name" {
  description = "Name of the R2 bucket holding the recordings"
  value       = module.audio.bucket_name
}

output "audio_custom_domain" {
  description = "Public domain the recordings are served from"
  value       = module.audio.custom_domain
}
