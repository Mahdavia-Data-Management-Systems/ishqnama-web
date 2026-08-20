variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
}

variable "environment_name" {
  description = "Name of the Container Apps environment"
  type        = string
}

variable "container_app_name" {
  description = "Name of the Container App"
  type        = string
}

variable "container_registry" {
  description = "Container registry configuration (optional for public images)"
  type = object({
    server   = string
    username = string
    password = string
  })
  default   = null
  sensitive = true
}

variable "containers" {
  description = "List of containers to deploy in the Container App"
  type = list(object({
    name   = string
    image  = string
    cpu    = number
    memory = string
    env = optional(list(object({
      name        = string
      value       = optional(string)
      secret_name = optional(string)
    })), [])
    ports = optional(list(object({
      port     = number
      protocol = optional(string, "TCP")
    })), [])
    probes = optional(list(object({
      type              = string # Startup, Liveness, Readiness
      transport         = string # HTTP, TCP
      port              = number
      path              = optional(string)
      interval_seconds  = optional(number, 10)
      timeout           = optional(number, 1)
      failure_threshold = optional(number, 3)
      initial_delay     = optional(number, 0)
      success_threshold = optional(number, 1)
    })), [])
    volume_mounts = optional(list(object({
      name = string
      path = string
    })), [])
  }))

  validation {
    condition     = length(var.containers) > 0
    error_message = "At least one container must be specified."
  }
}

variable "secrets" {
  description = "Secrets to inject into the Container App"
  type = list(object({
    name  = string
    value = string
  }))
  default   = []
  sensitive = true
}

variable "volumes" {
  description = "Volumes to mount in the Container App"
  type = list(object({
    name         = string
    storage_type = optional(string, "EmptyDir")
    storage_name = optional(string)
  }))
  default = []
}

variable "ingress" {
  description = "Ingress configuration for the Container App"
  type = object({
    external       = bool
    target_port    = number
    exposed_port   = optional(number)
    transport      = optional(string, "auto")
    allow_insecure = optional(bool, false)
  })
  default = null
}

variable "min_replicas" {
  description = "Minimum number of replicas"
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum number of replicas"
  type        = number
  default     = 1
}

variable "revision_mode" {
  description = "Revision mode for the Container App (Single or Multiple)"
  type        = string
  default     = "Single"

  validation {
    condition     = contains(["Single", "Multiple"], var.revision_mode)
    error_message = "revision_mode must be 'Single' or 'Multiple'."
  }
}

variable "public_network_access" {
  description = "Whether the ACA environment is accessible from public networks"
  type        = string
  default     = "Enabled"

  validation {
    condition     = contains(["Enabled", "Disabled"], var.public_network_access)
    error_message = "public_network_access must be 'Enabled' or 'Disabled'."
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
