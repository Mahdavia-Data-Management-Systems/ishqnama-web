variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "domain" {
  description = "Domain name to add to Cloudflare"
  type        = string
}

variable "plan" {
  description = "Cloudflare plan type"
  type        = string
  default     = "free"
}
