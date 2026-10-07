# The API, retaining the runtime settings of the pre-Terraform Azure deployment.

resource "azurerm_container_app" "api" {
  name                         = local.api_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.apps.name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.pull.id]
  }

  registry {
    server   = local.platform.registry_login_server
    identity = azurerm_user_assigned_identity.pull.id
  }

  secret {
    name  = "gmaps-api-key"
    value = var.gcp_maps_platform_api_key
  }

  secret {
    name  = "gmaps-signature-secret"
    value = var.gcp_maps_platform_signature_secret
  }

  dynamic "secret" {
    for_each = local.admin_enabled ? [1] : []
    content {
      name  = "admin-session-secret"
      value = var.admin_session_secret
    }
  }

  ingress {
    external_enabled           = true
    target_port                = 8000
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    # One replica: the admin's locks, rate limit and ingestion slot live in memory.
    min_replicas = 1
    max_replicas = 1

    volume {
      name         = "maps"
      storage_type = "AzureFile"
      storage_name = azurerm_container_app_environment_storage.maps.name
      # The image's appuser is uid/gid 10001 (Dockerfile.prod); chmod is not
      # possible on the share, so ownership and modes come from here.
      mount_options = "uid=10001,gid=10001,dir_mode=0750,file_mode=0640"
    }

    container {
      name   = "api"
      image  = var.api_image
      cpu    = var.api_size.cpu
      memory = var.api_size.memory

      env {
        name        = "GCP_MAPS_PLATFORM_API_KEY"
        secret_name = "gmaps-api-key"
      }

      env {
        name        = "GCP_MAPS_PLATFORM_SIGNATURE_SECRET"
        secret_name = "gmaps-signature-secret"
      }

      # Product thresholds: the API owns them and publishes them at GET /config.
      env {
        name  = "OVERLAP_THRESHOLD_PERCENTAGE"
        value = tostring(var.overlap_threshold_percentage)
      }

      env {
        name  = "DEFORESTATION_THRESHOLD_PERCENTAGE"
        value = tostring(var.deforestation_threshold_percentage)
      }

      # The image carries no layers: they live on the share.
      env {
        name  = "MAPS_ROOT"
        value = "/mnt/maps"
      }

      dynamic "env" {
        for_each = local.admin_enabled ? [1] : []
        content {
          name        = "ADMIN_SESSION_SECRET"
          secret_name = "admin-session-secret"
        }
      }

      dynamic "env" {
        for_each = local.admin_enabled ? [1] : []
        content {
          name  = "ADMIN_ALLOWED_ORIGIN"
          value = coalesce(var.admin_allowed_origin, local.web_url)
        }
      }

      volume_mounts {
        name = "maps"
        path = "/mnt/maps"
      }

      # Startup and readiness check the share through /health.
      startup_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health"
        initial_delay           = 5
        interval_seconds        = 5
        failure_count_threshold = 24
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health"
        interval_seconds        = 15
        timeout                 = 3
        failure_count_threshold = 3
      }

      # Not /health: a slow share must not restart the only replica (readiness only
      # takes it out of rotation).
      liveness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health/live"
        interval_seconds        = 30
        timeout                 = 5
        failure_count_threshold = 3
      }
    }
  }

  # The first pull needs the role assignment (it can take a minute to propagate;
  # infra/deploy.sh retries once).
  depends_on = [azurerm_role_assignment.acr_pull]
}
