terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.environment_name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_app_environment" "this" {
  name                           = var.environment_name
  location                       = var.location
  resource_group_name            = var.resource_group_name
  log_analytics_workspace_id     = azurerm_log_analytics_workspace.this.id
  infrastructure_subnet_id       = var.infrastructure_subnet_id
  internal_load_balancer_enabled = var.internal_load_balancer_enabled
  public_network_access          = var.internal_load_balancer_enabled ? "Disabled" : "Enabled"
  tags                           = var.tags
}

resource "azurerm_container_app" "this" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = var.revision_mode
  tags                         = var.tags

  dynamic "registry" {
    for_each = var.container_registry != null ? [var.container_registry] : []
    content {
      server               = registry.value.server
      username             = registry.value.username
      password_secret_name = "registry-password"
    }
  }

  dynamic "secret" {
    for_each = var.container_registry != null ? [var.container_registry] : []
    content {
      name  = "registry-password"
      value = secret.value.password
    }
  }

  dynamic "secret" {
    for_each = var.secrets
    content {
      name  = secret.value.name
      value = secret.value.value
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    dynamic "container" {
      for_each = var.containers
      content {
        name   = container.value.name
        image  = container.value.image
        cpu    = container.value.cpu
        memory = container.value.memory

        dynamic "env" {
          for_each = container.value.env
          content {
            name        = env.value.name
            value       = env.value.secret_name == null ? env.value.value : null
            secret_name = env.value.secret_name
          }
        }

        dynamic "liveness_probe" {
          for_each = [for p in container.value.probes : p if p.type == "Liveness"]
          content {
            transport               = liveness_probe.value.transport
            port                    = liveness_probe.value.port
            path                    = liveness_probe.value.path
            interval_seconds        = liveness_probe.value.interval_seconds
            timeout                 = liveness_probe.value.timeout
            failure_count_threshold = liveness_probe.value.failure_threshold
            initial_delay           = liveness_probe.value.initial_delay
          }
        }

        dynamic "readiness_probe" {
          for_each = [for p in container.value.probes : p if p.type == "Readiness"]
          content {
            transport               = readiness_probe.value.transport
            port                    = readiness_probe.value.port
            path                    = readiness_probe.value.path
            interval_seconds        = readiness_probe.value.interval_seconds
            timeout                 = readiness_probe.value.timeout
            failure_count_threshold = readiness_probe.value.failure_threshold
            success_count_threshold = readiness_probe.value.success_threshold
          }
        }

        dynamic "startup_probe" {
          for_each = [for p in container.value.probes : p if p.type == "Startup"]
          content {
            transport               = startup_probe.value.transport
            port                    = startup_probe.value.port
            path                    = startup_probe.value.path
            interval_seconds        = startup_probe.value.interval_seconds
            timeout                 = startup_probe.value.timeout
            failure_count_threshold = startup_probe.value.failure_threshold
          }
        }

        dynamic "volume_mounts" {
          for_each = container.value.volume_mounts
          content {
            name = volume_mounts.value.name
            path = volume_mounts.value.path
          }
        }
      }
    }

    dynamic "volume" {
      for_each = var.volumes
      content {
        name         = volume.value.name
        storage_type = volume.value.storage_type
        storage_name = volume.value.storage_name
      }
    }
  }

  dynamic "ingress" {
    for_each = var.ingress != null ? [var.ingress] : []
    content {
      external_enabled = ingress.value.external
      target_port      = ingress.value.target_port
      transport        = ingress.value.transport
      exposed_port     = ingress.value.exposed_port

      traffic_weight {
        latest_revision = true
        percentage      = 100
      }
    }
  }
}
