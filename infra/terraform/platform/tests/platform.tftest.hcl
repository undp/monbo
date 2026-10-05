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
