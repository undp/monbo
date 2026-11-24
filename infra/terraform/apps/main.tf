# The destroyable part of an environment: the Container Apps environment and the two
# apps, in the environment's one group (platform's output). Applied by infra/deploy.sh
# on every deploy, with the new image references. `terraform destroy` here leaves the
# layers (platform stack) intact.

locals {
  prefix = "monbo-${var.env}"
  tags = {
    app = "monbo"
    env = var.env
  }

  api_name = "monbo-api"
  web_name = "monbo-front"
  # Both URLs come from the environment's domain, not from the apps, so neither app
  # depends on the other.
  api_url = "https://${local.api_name}.${azurerm_container_app_environment.main.default_domain}"
  web_url = "https://${local.web_name}.${azurerm_container_app_environment.main.default_domain}"

  # Whether a secret is set is not itself secret (it only toggles the admin).
  admin_enabled = nonsensitive(var.admin_session_secret != null)
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${local.prefix}-env"
  resource_group_name        = local.group
  location                   = local.platform.location
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = local.platform.log_analytics_workspace_id
  tags                       = local.tags
}

# The share, registered on the environment as "maps": what the API's volume refers to.
resource "azurerm_container_app_environment_storage" "maps" {
  name                         = "maps"
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = local.platform.storage_account_name
  share_name                   = local.platform.maps_share_name
  access_key                   = data.azurerm_storage_account.data.primary_access_key
  access_mode                  = "ReadWrite"
}

# Both apps pull their images with this identity. Terraform assigns it no role: an
# administrator grants it AcrPull on the registry, and the apps pull with the registry's
# admin user until then (registry_admin_enabled, platform stack).
resource "azurerm_user_assigned_identity" "pull" {
  name                = "${local.prefix}-pull"
  resource_group_name = local.group
  location            = local.platform.location
  tags                = local.tags
}
