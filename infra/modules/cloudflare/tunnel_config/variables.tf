variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
}

variable "tunnel_id" {
  description = "Cloudflare Tunnel ID"
  type        = string
}

variable "domain" {
  description = "Domain name (e.g. ishqnama.com)"
  type        = string
}

variable "service_url" {
  description = "Local service URL the tunnel forwards to (e.g. http://localhost:8080)"
  type        = string
  default     = "http://localhost:8080"
}
