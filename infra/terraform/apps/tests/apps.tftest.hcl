# Applies the apps stack against mocked providers (nothing is created) and a fake
# platform state: checks the Container Apps' runtime settings without Azure credentials.
# Run: terraform init -backend=false && terraform test

mock_provider "azurerm" {
  mock_data "azurerm_storage_account" {
    defaults = {
      primary_access_key = "mock-key"
    }
  }

  # Realistic ids: the provider parses them when other resources reference them.
  mock_resource "azurerm_container_app_environment" {
    defaults = {
      id             = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-apps/providers/Microsoft.App/managedEnvironments/monbo-dev-env"
      default_domain = "happy.eastus2.azurecontainerapps.io"
    }
  }

  mock_resource "azurerm_user_assigned_identity" {
    defaults = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-apps/providers/Microsoft.ManagedIdentity/userAssignedIdentities/monbo-dev-pull"
      principal_id = "11111111-1111-1111-1111-111111111111"
    }
  }
}

override_data {
  target = data.terraform_remote_state.platform
  values = {
    outputs = {
      location                   = "eastus2"
      data_resource_group_name   = "monbo-dev-data"
      storage_account_name       = "monbodevdata"
      maps_share_name            = "maps"
      registry_id                = "/subscriptions/0/resourceGroups/monbo-dev-platform/providers/Microsoft.ContainerRegistry/registries/monbodevacr"
      registry_login_server      = "monbodevacr.azurecr.io"
      log_analytics_workspace_id = "/subscriptions/0/resourceGroups/monbo-dev-platform/providers/Microsoft.OperationalInsights/workspaces/monbo-dev-logs"
    }
  }
}

variables {
  env                                = "dev"
  state_storage_account_name         = "monbotfstate"
  api_image                          = "monbodevacr.azurecr.io/monbo-api:abc1234"
  web_image                          = "monbodevacr.azurecr.io/monbo-front:abc1234"
  gcp_maps_platform_api_key          = "api-key"
  gcp_maps_platform_signature_secret = "signature"
  deforestation_threshold_percentage = 2
}

run "api_matches_the_previous_definition" {
  command = apply

  assert {
    condition     = azurerm_container_app.api.template[0].min_replicas == 1 && azurerm_container_app.api.template[0].max_replicas == 1
    error_message = "The API must stay on exactly one replica."
  }

  assert {
    condition     = azurerm_container_app.api.template[0].volume[0].mount_options == "uid=10001,gid=10001,dir_mode=0750,file_mode=0640"
    error_message = "The share must be mounted for uid/gid 10001."
  }

  assert {
    condition     = azurerm_container_app.api.template[0].container[0].volume_mounts[0].path == "/mnt/maps"
    error_message = "The share must be mounted at /mnt/maps."
  }

  assert {
    condition = contains(
      [for e in azurerm_container_app.api.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"],
      "MAPS_ROOT=/mnt/maps",
    )
    error_message = "MAPS_ROOT must point at the mount."
  }

  assert {
    condition = (
      azurerm_container_app.api.template[0].container[0].startup_probe[0].path == "/health" &&
      azurerm_container_app.api.template[0].container[0].startup_probe[0].failure_count_threshold == 24 &&
      azurerm_container_app.api.template[0].container[0].readiness_probe[0].path == "/health" &&
      azurerm_container_app.api.template[0].container[0].liveness_probe[0].path == "/health/live"
    )
    error_message = "Probes must match: startup and readiness on /health, liveness on /health/live."
  }

  assert {
    condition     = azurerm_container_app.api.ingress[0].target_port == 8000 && azurerm_container_app.api.ingress[0].external_enabled
    error_message = "The API ingress must be external on port 8000."
  }

  assert {
    condition     = azurerm_container_app.api.registry[0].identity != null && azurerm_container_app.api.registry[0].password_secret_name == null
    error_message = "The registry must be pulled by identity, without a password."
  }

  assert {
    condition     = !contains([for e in azurerm_container_app.api.template[0].container[0].env : e.name], "ADMIN_SESSION_SECRET")
    error_message = "Without admin_session_secret the admin must be off."
  }
}

run "admin_on_with_a_secret" {
  command = apply

  variables {
    admin_session_secret = "0123456789abcdef0123456789abcdef"
  }

  assert {
    condition = contains(
      [for e in azurerm_container_app.api.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"],
      "ADMIN_ALLOWED_ORIGIN=https://monbo-front.happy.eastus2.azurecontainerapps.io",
    )
    error_message = "ADMIN_ALLOWED_ORIGIN must default to the web app's URL."
  }

  assert {
    condition     = contains([for e in azurerm_container_app.api.template[0].container[0].env : e.secret_name if e.name == "ADMIN_SESSION_SECRET"], "admin-session-secret")
    error_message = "ADMIN_SESSION_SECRET must be a secret reference."
  }
}

run "short_admin_secret_is_rejected" {
  command = plan

  variables {
    admin_session_secret = "too-short"
  }

  expect_failures = [var.admin_session_secret]
}

run "invalid_size_is_rejected" {
  command = plan

  variables {
    api_size = { cpu = 1, memory = "4Gi" }
  }

  expect_failures = [var.api_size]
}

run "web_matches_the_previous_definition" {
  command = apply

  assert {
    condition     = azurerm_container_app.web.ingress[0].target_port == 3000
    error_message = "The web ingress must target port 3000."
  }

  assert {
    condition = alltrue([
      for pair in [
        "NEXT_PUBLIC_API_URL=https://monbo-api.happy.eastus2.azurecontainerapps.io",
        "NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE=2",
        "NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE=1",
      ] : contains([for e in azurerm_container_app.web.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"], pair)
    ])
    error_message = "The web app must get the API URL and the thresholds."
  }

  assert {
    condition     = length(azurerm_container_app.web.template[0].container[0].env) == 7
    error_message = "The web app must get exactly the seven NEXT_PUBLIC_* variables."
  }
}
