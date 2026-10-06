# The platform stack of the same environment: registry, storage, logs.
data "terraform_remote_state" "platform" {
  backend = "azurerm"

  config = {
    resource_group_name  = var.state_resource_group_name
    storage_account_name = var.state_storage_account_name
    container_name       = var.state_container_name
    key                  = "${var.env}/platform.tfstate"
    use_azuread_auth     = true
  }
}

locals {
  platform = data.terraform_remote_state.platform.outputs
}

# For the environment storage's access key (Container Apps mounts Azure Files with it).
data "azurerm_storage_account" "data" {
  name                = local.platform.storage_account_name
  resource_group_name = local.platform.data_resource_group_name
}
