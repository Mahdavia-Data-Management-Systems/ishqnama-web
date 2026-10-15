variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "bucket_name" {
  description = "Name of the R2 bucket"
  type        = string
}

variable "location" {
  description = "Location hint for the bucket (apac, eeur, enam, weur, wnam, oc). Only honoured when the bucket is first created"
  type        = string
  default     = null
}

variable "storage_class" {
  description = "Default storage class for new objects (Standard or InfrequentAccess)"
  type        = string
  default     = "Standard"
}

variable "custom_domain" {
  description = "Public custom domain for the bucket (e.g. audio.ishqnama.com); null keeps the bucket private"
  type = object({
    domain  = string
    zone_id = string
    min_tls = optional(string, "1.2")
  })
  default = null
}

variable "cors_rules" {
  description = "CORS rules applied to the bucket; an empty list leaves CORS unmanaged"
  type = list(object({
    allowed_origins = list(string)
    allowed_methods = list(string)
    allowed_headers = optional(list(string))
    expose_headers  = optional(list(string))
    max_age_seconds = optional(number)
  }))
  default = []
}
