# Applies the platform stack against a mocked provider (nothing is created) and checks
# the layout every environment shares (one existing group, nothing that needs more than
# Contributor) and the protection the layers keep.
# Run: terraform init -backend=false && terraform test

mock_provider "azurerm" {
  # Realistic ids: the provider parses them when other resources reference them.
  mock_data "azurerm_resource_group" {
    defaults = {
      id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev"
      location = "westeurope"
    }
  }

  mock_resource "azurerm_storage_account" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev/providers/Microsoft.Storage/storageAccounts/monbodevdata"
    }
  }

  mock_resource "azurerm_container_registry" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev/providers/Microsoft.ContainerRegistry/registries/monbodevacr"
    }
  }

  mock_resource "azurerm_user_assigned_identity" {
    defaults = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev/providers/Microsoft.ManagedIdentity/userAssignedIdentities/monbo-dev-deploy"
      principal_id = "22222222-2222-2222-2222-222222222222"
      client_id    = "33333333-3333-3333-3333-333333333333"
    }
  }

  mock_resource "azurerm_backup_policy_file_share" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/monbo-dev/providers/Microsoft.RecoveryServices/vaults/monbo-dev-backup/backupPolicies/maps-daily-30d"
    }
  }
}

# dev's settings (envs/dev.tfvars).
variables {
  env                    = "dev"
  location               = "eastus"
  resource_group_name    = "monbo-dev"
  registry_admin_enabled = true
}

run "everything_in_the_one_group" {
  command = plan

  assert {
    condition = (
      azurerm_storage_account.data.name == "monbodevdata" &&
      azurerm_container_registry.main.name == "monbodevacr" &&
      azurerm_log_analytics_workspace.main.name == "monbo-dev-logs" &&
      azurerm_user_assigned_identity.deploy.name == "monbo-dev-deploy"
    )
    error_message = "Names must derive from env; the global ones have no hyphens and no suffix by default."
  }

  assert {
    condition = alltrue([
      for group in [
        azurerm_storage_account.data.resource_group_name,
        azurerm_container_registry.main.resource_group_name,
        azurerm_log_analytics_workspace.main.resource_group_name,
        azurerm_user_assigned_identity.deploy.resource_group_name,
        output.resource_group_name,
      ] : group == "monbo-dev"
    ])
    error_message = "Every resource must go in the environment's one group, and the output must name it."
  }

  assert {
    condition = (
      azurerm_storage_account.data.location == "eastus" &&
      azurerm_container_registry.main.location == "eastus" &&
      azurerm_user_assigned_identity.deploy.location == "eastus"
    )
    error_message = "Resources must take the environment's location, not the group's (westeurope here)."
  }
}

run "suffix_only_changes_the_global_names" {
  command = plan

  variables {
    unique_suffix = "ab1"
  }

  assert {
    condition = (
      azurerm_log_analytics_workspace.main.name == "monbo-dev-logs" &&
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
      length(azurerm_recovery_services_vault.backup) == 0 &&
      length(azurerm_backup_protected_file_share.maps) == 0 &&
      output.backup_vault_name == ""
    )
    error_message = "Without share_backup_enabled, there must be no vault and no protected share."
  }

  assert {
    condition     = azurerm_container_registry.main.admin_enabled && output.registry_admin_enabled
    error_message = "registry_admin_enabled must turn the registry's admin user on, and the output must say so."
  }
}

run "backup_when_enabled" {
  command = apply
  # Its own state: the runs after it would otherwise plan to destroy its protected vault.
  state_key = "backup"

  variables {
    share_backup_enabled = true
  }

  assert {
    condition = (
      azurerm_recovery_services_vault.backup[0].name == "monbo-dev-backup" &&
      azurerm_backup_policy_file_share.maps_daily[0].backup[0].frequency == "Daily" &&
      azurerm_backup_policy_file_share.maps_daily[0].backup[0].time == "06:00" &&
      azurerm_backup_policy_file_share.maps_daily[0].retention_daily[0].count == 30 &&
      length(azurerm_backup_protected_file_share.maps) == 1
    )
    error_message = "With share_backup_enabled, the share must be backed up daily at 06:00 and kept 30 days."
  }
}

run "registry_admin_off_once_acrpull_is_granted" {
  command = plan

  variables {
    registry_admin_enabled = false
  }

  assert {
    condition     = !azurerm_container_registry.main.admin_enabled && !output.registry_admin_enabled
    error_message = "With registry_admin_enabled false, the registry's admin user must be off."
  }
}

run "invalid_suffix_is_rejected" {
  command = plan

  variables {
    unique_suffix = "CHANGEME"
  }

  expect_failures = [var.unique_suffix]
}

run "deploy_identity_trusts_only_its_environment" {
  command = apply

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
      output.deploy_identity_client_id == "33333333-3333-3333-3333-333333333333" &&
      output.deploy_identity_principal_id == "22222222-2222-2222-2222-222222222222"
    )
    error_message = "The client id (GitHub secret) and principal id (administrator's grant) must be outputs."
  }
}

# prod is the same code with its own tfvars, in a group someone else granted (its name
# comes from the environment, not from the repository).
run "prod_is_its_own_environment" {
  command = apply
  # Its own state, so it doesn't plan over dev's resources from the runs above.
  state_key = "prod"

  variables {
    env                 = "prod"
    resource_group_name = "shared-granted-group"
  }

  override_data {
    target = data.azurerm_resource_group.main
    values = {
      id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/shared-granted-group"
      location = "westeurope"
    }
  }

  assert {
    condition = (
      azurerm_storage_account.data.name == "monboproddata" &&
      azurerm_storage_account.data.resource_group_name == "shared-granted-group" &&
      azurerm_container_registry.main.name == "monboprodacr" &&
      azurerm_user_assigned_identity.deploy.name == "monbo-prod-deploy"
    )
    error_message = "prod's resources must be named monboproddata, monboprodacr and monbo-prod-*, in its group."
  }

  assert {
    condition     = azurerm_federated_identity_credential.github.subject == "repo:undp/monbo:environment:prod"
    error_message = "prod's deploy identity must trust only the prod GitHub Environment."
  }
}
