# The long-lived part of an environment: the layers and what protects them, the
# image registry and the log workspace. Applied by hand after reading its plan;
# infra/deploy.sh never applies this stack.

locals {
  prefix = "monbo-${var.env}"
  # Storage accounts and registries take lowercase letters and digits only, and their
  # names are global across Azure: monbo<env><suffix>data, monbo<env><suffix>acr.
  compact = "monbo${var.env}${var.unique_suffix}"
  tags = {
    app = "monbo"
    env = var.env
  }
}

# --- Data: the layers ---------------------------------------------------------
# Its own resource group with a delete lock: nothing here is deleted by accident,
# and destroying the apps stack never touches it.

resource "azurerm_resource_group" "data" {
  name     = "${local.prefix}-data"
  location = var.location
  tags     = merge(local.tags, { purpose = "layers" })
}

resource "azurerm_storage_account" "data" {
  name                            = "${local.compact}data"
  resource_group_name             = azurerm_resource_group.data.name
  location                        = azurerm_resource_group.data.location
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

# Daily snapshots of the share at 06:00 UTC, kept 30 days.
resource "azurerm_recovery_services_vault" "backup" {
  name                = "${local.prefix}-backup"
  resource_group_name = azurerm_resource_group.data.name
  location            = azurerm_resource_group.data.location
  sku                 = "Standard"
  tags                = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_backup_policy_file_share" "maps_daily" {
  name                = "maps-daily-30d"
  resource_group_name = azurerm_resource_group.data.name
  recovery_vault_name = azurerm_recovery_services_vault.backup.name
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
  resource_group_name = azurerm_resource_group.data.name
  recovery_vault_name = azurerm_recovery_services_vault.backup.name
  storage_account_id  = azurerm_storage_account.data.id
}

resource "azurerm_backup_protected_file_share" "maps" {
  resource_group_name       = azurerm_resource_group.data.name
  recovery_vault_name       = azurerm_recovery_services_vault.backup.name
  source_storage_account_id = azurerm_backup_container_storage_account.data.storage_account_id
  source_file_share_name    = azurerm_storage_share.maps.name
  backup_policy_id          = azurerm_backup_policy_file_share.maps_daily.id

  lifecycle {
    prevent_destroy = true
  }
}

# Created last, so it never blocks Terraform while it builds the group. Removing it
# is a deliberate step (docs/suggested_deployment.md).
resource "azurerm_management_lock" "data" {
  name       = "${local.prefix}-data-no-delete"
  scope      = azurerm_resource_group.data.id
  lock_level = "CanNotDelete"
  notes      = "Holds the Monbo layers; remove this lock before deleting anything here"

  depends_on = [azurerm_backup_protected_file_share.maps]
}

# --- Platform: registry and logs ----------------------------------------------
# Outside the locked group: losing them loses nothing that can't be rebuilt, and
# cleaning old images or logs must not need the lock removed.

resource "azurerm_resource_group" "platform" {
  name     = "${local.prefix}-platform"
  location = var.location
  tags     = local.tags
}

# The apps pull with a managed identity (AcrPull, apps stack): no admin user, so
# no registry password exists anywhere.
resource "azurerm_container_registry" "main" {
  name                = "${local.compact}acr"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.prefix}-logs"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.tags
}
