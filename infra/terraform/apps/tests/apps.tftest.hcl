# Applies the apps stack against mocked providers (nothing is created) and a fake
# platform state: checks the Container Apps' runtime settings without Azure credentials.
# Run: terraform init -backend=false && terraform test

mock_provider "azurerm" {
  mock_data "azurerm_storage_account" {
    defaults = {
      primary_access_key = "mock-key"
    }
  }

  mock_data "azurerm_container_registry" {
    defaults = {
      admin_username = "monbodevacr"
      admin_password = "mock-registry-password"
    }
  }

  # Realistic ids: the provider parses them when other resources reference them.
  mock_resource "azurerm_container_app_environment" {
    defaults = {
      id             = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev/providers/Microsoft.App/managedEnvironments/monbo-dev-env"
      default_domain = "happy.eastus2.azurecontainerapps.io"
    }
  }

  mock_resource "azurerm_user_assigned_identity" {
    defaults = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev/providers/Microsoft.ManagedIdentity/userAssignedIdentities/monbo-dev-pull"
      principal_id = "11111111-1111-1111-1111-111111111111"
    }
  }
}

override_data {
  target = data.terraform_remote_state.platform
  values = {
    outputs = {
      location                   = "eastus"
      resource_group_name        = "monbo-dev"
      storage_account_name       = "monbodevdata"
      maps_share_name            = "maps"
      registry_id                = "/subscriptions/0/resourceGroups/monbo-dev/providers/Microsoft.ContainerRegistry/registries/monbodevacr"
      registry_name              = "monbodevacr"
      registry_login_server      = "monbodevacr.azurecr.io"
      registry_admin_enabled     = false
      log_analytics_workspace_id = "/subscriptions/0/resourceGroups/monbo-dev/providers/Microsoft.OperationalInsights/workspaces/monbo-dev-logs"
    }
  }
}

variables {
  env                                = "dev"
  resource_group_name                = "monbo-dev"
  state_storage_account_name         = "monbodevtfstate"
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
    condition = contains(
      [for e in azurerm_container_app.api.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"],
      "USAGE_DIR=/mnt/maps/usage",
    )
    error_message = "USAGE_DIR must be a folder of the mounted share."
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
      ] : contains([for e in azurerm_container_app.web.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"], pair)
    ])
    error_message = "The web app must get the API URL."
  }

  assert {
    condition     = length(azurerm_container_app.web.template[0].container[0].env) == 5
    error_message = "The web app must get exactly its five NEXT_PUBLIC_* variables (the thresholds come from the API)."
  }

  assert {
    condition = !anytrue([
      for e in azurerm_container_app.web.template[0].container[0].env : strcontains(e.name, "THRESHOLD")
    ])
    error_message = "The thresholds must not be frontend variables."
  }
}

run "api_owns_the_thresholds" {
  command = apply

  assert {
    condition = alltrue([
      for pair in ["OVERLAP_THRESHOLD_PERCENTAGE=1", "DEFORESTATION_THRESHOLD_PERCENTAGE=2"] :
      contains([for e in azurerm_container_app.api.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"], pair)
    ])
    error_message = "The API must get both thresholds, which it publishes at GET /config."
  }
}

run "prod_hides_the_testing_banner" {
  command = apply

  variables {
    env                              = "prod"
    state_storage_account_name       = "monboprodtfstate"
    show_testing_environment_warning = false
  }

  assert {
    condition = contains(
      [for e in azurerm_container_app.web.template[0].container[0].env : "${e.name}=${e.value == null ? "" : e.value}"],
      "NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING=false",
    )
    error_message = "prod must hide the testing-environment banner."
  }
}

# The runs above pull by identity (AcrPull granted). This is every new environment until
# an administrator grants AcrPull (envs/*.tfvars of the platform stack).
run "registry_admin_until_acrpull" {
  command = apply

  override_data {
    target = data.terraform_remote_state.platform
    values = {
      outputs = {
        location                   = "eastus"
        resource_group_name        = "monbo-dev"
        storage_account_name       = "monbodevdata"
        maps_share_name            = "maps"
        registry_id                = "/subscriptions/0/resourceGroups/monbo-dev/providers/Microsoft.ContainerRegistry/registries/monbodevacr"
        registry_name              = "monbodevacr"
        registry_login_server      = "monbodevacr.azurecr.io"
        registry_admin_enabled     = true
        log_analytics_workspace_id = "/subscriptions/0/resourceGroups/monbo-dev/providers/Microsoft.OperationalInsights/workspaces/monbo-dev-logs"
      }
    }
  }

  assert {
    condition = alltrue([
      for app in [azurerm_container_app.api, azurerm_container_app.web] : (
        length(app.registry) == 1 &&
        app.registry[0].server == "monbodevacr.azurecr.io" &&
        app.registry[0].username == "monbodevacr" &&
        app.registry[0].password_secret_name == "registry-password" &&
        contains([for s in app.secret : s.name], "registry-password") &&
        length(app.identity[0].identity_ids) == 1
      )
    ])
    error_message = "With registry_admin_enabled, both apps must pull with the admin user and keep the pull identity attached."
  }
}

run "everything_in_the_platforms_group" {
  command = apply

  assert {
    condition = (
      azurerm_container_app_environment.main.resource_group_name == "monbo-dev" &&
      azurerm_container_app_environment.main.location == "eastus" &&
      azurerm_user_assigned_identity.pull.resource_group_name == "monbo-dev" &&
      azurerm_user_assigned_identity.pull.name == "monbo-dev-pull" &&
      azurerm_container_app.api.resource_group_name == "monbo-dev" &&
      azurerm_container_app.web.resource_group_name == "monbo-dev" &&
      output.resource_group_name == "monbo-dev" &&
      output.pull_identity_principal_id == "11111111-1111-1111-1111-111111111111"
    )
    error_message = "The apps must go in the platform's group and location, and output the pull identity for the AcrPull grant."
  }
}
