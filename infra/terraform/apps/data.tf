# The platform stack of the same environment: its group, registry, storage, logs. Read
# with the state account's key (ARM_ACCESS_KEY, exported by infra/lib.sh).
data "terraform_remote_state" "platform" {
  backend = "azurerm"

  config = {
    resource_group_name  = var.resource_group_name
    storage_account_name = var.state_storage_account_name
    container_name       = var.state_container_name
    key                  = "${var.env}/platform.tfstate"
  }
}

locals {
  platform = data.terraform_remote_state.platform.outputs
  group    = var.resource_group_name
}

# The registry's admin credentials, read at every apply (so a rotated password is
# picked up), only while the apps pull with them.
data "azurerm_container_registry" "main" {
  count               = local.platform.registry_admin_enabled ? 1 : 0
  name                = local.platform.registry_name
  resource_group_name = local.group
}

# For the environment storage's access key (Container Apps mounts Azure Files with it).
data "azurerm_storage_account" "data" {
  name                = local.platform.storage_account_name
  resource_group_name = local.group
}
