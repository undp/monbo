# The long-lived part of an environment: the layers and what protects them, the
# image registry and the log workspace. Applied by hand after reading its plan;
# infra/deploy.sh never applies this stack.
#
# Every environment lives in one resource group that already exists (prod: the one UNDP
# granted, where the operators only hold Contributor; dev: the same layout, so it tests
# what prod runs). The group is read, never created, modified or locked; nothing here
# needs more than Contributor on it (docs/suggested_deployment.md#production).

locals {
  prefix = "monbo-${var.env}"
  # Storage accounts and registries take lowercase letters and digits only, and their
  # names are global across Azure: monbo<env><suffix>data, monbo<env><suffix>acr.
  compact = "monbo${var.env}${var.unique_suffix}"
  tags = {
    app = "monbo"
    env = var.env
  }
  group = data.azurerm_resource_group.main.name
}

data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# --- Data: the layers ---------------------------------------------------------

resource "azurerm_storage_account" "data" {
  name                            = "${local.compact}data"
  resource_group_name             = local.group
  location                        = var.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  tags                            = local.tags

  # A deleted share can be undeleted for 14 days.
  share_properties {
    retention_policy {
      days = 14
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# The per-country layout the API mounts at /mnt/maps (docs/maps.md).
resource "azurerm_storage_share" "maps" {
  name               = "maps"
  storage_account_id = azurerm_storage_account.data.id
  quota              = var.share_quota_gb
  enabled_protocol   = "SMB"

  lifecycle {
    prevent_destroy = true
  }
}

# Daily snapshots of the share at 06:00 UTC, kept 30 days. Off by default
# (share_backup_enabled): registering the account with the vault puts a lock on it,
# which Contributor alone can't do.
resource "azurerm_recovery_services_vault" "backup" {
  count               = var.share_backup_enabled ? 1 : 0
  name                = "${local.prefix}-backup"
  resource_group_name = local.group
  location            = var.location
  sku                 = "Standard"
  tags                = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_backup_policy_file_share" "maps_daily" {
  count               = var.share_backup_enabled ? 1 : 0
  name                = "maps-daily-30d"
  resource_group_name = local.group
  recovery_vault_name = azurerm_recovery_services_vault.backup[0].name
  timezone            = "UTC"

  backup {
    frequency = "Daily"
    time      = "06:00"
  }

  retention_daily {
    count = 30
  }
}

resource "azurerm_backup_container_storage_account" "data" {
  count               = var.share_backup_enabled ? 1 : 0
  resource_group_name = local.group
  recovery_vault_name = azurerm_recovery_services_vault.backup[0].name
  storage_account_id  = azurerm_storage_account.data.id
}

resource "azurerm_backup_protected_file_share" "maps" {
  count                     = var.share_backup_enabled ? 1 : 0
  resource_group_name       = local.group
  recovery_vault_name       = azurerm_recovery_services_vault.backup[0].name
  source_storage_account_id = azurerm_backup_container_storage_account.data[0].storage_account_id
  source_file_share_name    = azurerm_storage_share.maps.name
  backup_policy_id          = azurerm_backup_policy_file_share.maps_daily[0].id

  lifecycle {
    prevent_destroy = true
  }
}

# --- Platform: registry and logs ----------------------------------------------

# The apps pull with a managed identity (the apps stack's pull identity, once an
# administrator grants it AcrPull): no admin user, so no registry password exists.
# registry_admin_enabled turns the admin user on until that grant exists.
resource "azurerm_container_registry" "main" {
  name                = "${local.compact}acr"
  resource_group_name = local.group
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = var.registry_admin_enabled
  tags                = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.prefix}-logs"
  resource_group_name = local.group
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.tags
}
