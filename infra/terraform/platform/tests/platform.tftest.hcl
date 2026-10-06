# Applies the platform stack against a mocked provider (nothing is created) and checks
# the protection the layers need. Run: terraform init -backend=false && terraform test

mock_provider "azurerm" {
  # Realistic ids: the provider parses them when other resources reference them.
  mock_resource "azurerm_resource_group" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-data"
    }
  }

  mock_resource "azurerm_storage_account" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-data/providers/Microsoft.Storage/storageAccounts/monbodevdata"
    }
  }

  mock_resource "azurerm_container_registry" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-platform/providers/Microsoft.ContainerRegistry/registries/monbodevacr"
    }
  }

  mock_resource "azurerm_user_assigned_identity" {
    defaults = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-platform/providers/Microsoft.ManagedIdentity/userAssignedIdentities/monbo-dev-deploy"
      principal_id = "22222222-2222-2222-2222-222222222222"
      client_id    = "33333333-3333-3333-3333-333333333333"
    }
  }

  mock_data "azurerm_subscription" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000"
    }
  }

  mock_data "azurerm_storage_account" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-tfstate/providers/Microsoft.Storage/storageAccounts/monbotfstate"
    }
  }

  mock_resource "azurerm_backup_policy_file_share" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev-data/providers/Microsoft.RecoveryServices/vaults/monbo-dev-backup/backupPolicies/maps-daily-30d"
    }
  }
}

variables {
  env = "dev"
}

run "names_follow_the_environment" {
  command = plan

  assert {
    condition = (
      azurerm_resource_group.data.name == "monbo-dev-data" &&
      azurerm_resource_group.platform.name == "monbo-dev-platform" &&
      azurerm_recovery_services_vault.backup.name == "monbo-dev-backup" &&
      azurerm_storage_account.data.name == "monbodevdata" &&
      azurerm_container_registry.main.name == "monbodevacr"
    )
    error_message = "Names must derive from env; the global ones have no hyphens and no suffix by default."
  }
}

run "suffix_only_changes_the_global_names" {
  command = plan

  variables {
    unique_suffix = "ab1"
  }

  assert {
    condition = (
      azurerm_resource_group.data.name == "monbo-dev-data" &&
      azurerm_storage_account.data.name == "monbodevab1data" &&
      azurerm_container_registry.main.name == "monbodevab1acr"
    )
    error_message = "unique_suffix must only change the storage account and registry names."
  }
}

run "layers_are_protected" {
  command = apply

  assert {
    condition = (
      azurerm_storage_account.data.min_tls_version == "TLS1_2" &&
      !azurerm_storage_account.data.allow_nested_items_to_be_public &&
      azurerm_storage_account.data.https_traffic_only_enabled
    )
    error_message = "The storage account must require TLS 1.2 and HTTPS and disable public blob access."
  }

  assert {
    condition     = azurerm_storage_account.data.share_properties[0].retention_policy[0].days == 14
    error_message = "Share soft delete must keep deleted shares for 14 days."
  }

  assert {
    condition = (
      azurerm_backup_policy_file_share.maps_daily.backup[0].frequency == "Daily" &&
      azurerm_backup_policy_file_share.maps_daily.backup[0].time == "06:00" &&
      azurerm_backup_policy_file_share.maps_daily.retention_daily[0].count == 30
    )
    error_message = "The share must be backed up daily at 06:00 and kept 30 days."
  }

  assert {
    condition     = azurerm_management_lock.data.lock_level == "CanNotDelete"
    error_message = "The data resource group must carry a CanNotDelete lock."
  }

  assert {
    condition     = !azurerm_container_registry.main.admin_enabled
    error_message = "The registry admin user must be off."
  }
}

run "invalid_suffix_is_rejected" {
  command = plan

  variables {
    unique_suffix = "CHANGEME"
  }

  expect_failures = [var.unique_suffix]
}

run "deploy_identity_trusts_only_the_dev_environment" {
  command = apply

  assert {
    condition     = azurerm_user_assigned_identity.deploy.name == "monbo-dev-deploy"
    error_message = "The deploy identity must be monbo-<env>-deploy."
  }

  assert {
    condition = (
      azurerm_federated_identity_credential.github.issuer == "https://token.actions.githubusercontent.com" &&
      azurerm_federated_identity_credential.github.subject == "repo:undp/monbo:environment:dev" &&
      contains(azurerm_federated_identity_credential.github.audience, "api://AzureADTokenExchange")
    )
    error_message = "The federated credential must trust only undp/monbo's dev GitHub Environment."
  }

  assert {
    condition = (
      azurerm_role_assignment.deploy_reader.role_definition_name == "Reader" &&
      azurerm_role_assignment.deploy_reader.scope == "/subscriptions/00000000-0000-0000-0000-000000000000" &&
      azurerm_role_assignment.deploy_acr_push.role_definition_name == "AcrPush" &&
      endswith(azurerm_role_assignment.deploy_acr_push.scope, "/registries/monbodevacr") &&
      azurerm_role_assignment.deploy_state.role_definition_name == "Storage Blob Data Contributor" &&
      endswith(azurerm_role_assignment.deploy_state.scope, "/storageAccounts/monbotfstate")
    )
    error_message = "The deploy identity must get Reader (subscription), AcrPush (registry) and Storage Blob Data Contributor (state) only."
  }

  assert {
    condition     = output.deploy_identity_client_id == "33333333-3333-3333-3333-333333333333"
    error_message = "The client id must be an output, for the GitHub Environment."
  }
}

