# The frontend. Its image carries __NEXT_PUBLIC_*__ placeholders that entrypoint.sh
# replaces at container start with these env vars, so the same image runs in any
# environment. A new NEXT_PUBLIC_* variable goes here, in config/env.ts, entrypoint.sh
# and the .env.*.example files. Product settings the API can own (the thresholds) don't:
# the frontend reads them from the API's GET /config.

resource "azurerm_container_app" "web" {
  name                         = local.web_name
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

  # Exposed to the browser anyway, but kept out of the plain configuration.
  secret {
    name  = "gmaps-browser-key"
    value = coalesce(var.front_gcp_maps_platform_api_key, var.gcp_maps_platform_api_key)
  }

  ingress {
    external_enabled           = true
    target_port                = 3000
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "web"
      image  = var.web_image
      cpu    = var.web_size.cpu
      memory = var.web_size.memory

      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = local.api_url
      }

      env {
        name        = "NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY"
        secret_name = "gmaps-browser-key"
      }

      env {
        name  = "NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING"
        value = tostring(var.show_testing_environment_warning)
      }

      env {
        name  = "NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION"
        value = tostring(var.max_requests_for_satellite_background)
      }

      env {
        name  = "NEXT_PUBLIC_CONTACT_URL"
        value = var.contact_url
      }

      startup_probe {
        transport               = "HTTP"
        port                    = 3000
        path                    = "/api/health"
        interval_seconds        = 5
        failure_count_threshold = 24
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}
