# The identity GitHub Actions deploys with (.github/workflows/deploy.yml). No secret:
# Azure trusts GitHub's OIDC token, but only for jobs of this repository running in the
# GitHub Environment named after this environment, which is limited to its branch.
#
# Roles: this stack grants the ones the operators may assign. Two more are granted once
# by an Owner allowed to (docs/suggested_deployment.md#continuous-deployment):
# Contributor on monbo-<env>-apps and Storage Account Key Operator on the layer storage.

resource "azurerm_user_assigned_identity" "deploy" {
  name                = "${local.prefix}-deploy"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-${var.env}"
  user_assigned_identity_id = azurerm_user_assigned_identity.deploy.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "repo:${var.github_repository}:environment:${var.env}"
}

data "azurerm_subscription" "current" {}

data "azurerm_client_config" "current" {}

# The Terraform state account is created by infra/bootstrap.sh, not by this stack.
data "azurerm_storage_account" "state" {
  name                = var.state_storage_account_name
  resource_group_name = var.state_resource_group_name
}

# The provider lists the subscription's resource providers, and the deploy reads the
# platform and data resources: read-only, subscription-wide.
resource "azurerm_role_assignment" "deploy_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Reader"
  principal_id         = azurerm_user_assigned_identity.deploy.principal_id
  principal_type       = "ServicePrincipal"
}

resource "azurerm_role_assignment" "deploy_acr_push" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPush"
  principal_id         = azurerm_user_assigned_identity.deploy.principal_id
  principal_type       = "ServicePrincipal"
}

# Read platform's state, read and write apps's (the account only accepts Entra ID).
resource "azurerm_role_assignment" "deploy_state" {
  scope                = data.azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.deploy.principal_id
  principal_type       = "ServicePrincipal"
}
