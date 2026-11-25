# The identity GitHub Actions deploys with (.github/workflows/deploy.yml). No secret:
# Azure trusts GitHub's OIDC token, but only for jobs of this repository running in the
# GitHub Environment named after this environment, which is limited to its branch.
#
# Terraform assigns it no role (the operators may not be able to): an administrator
# grants it Contributor on the environment's group once, which covers applying the
# apps, reading the storage and state keys, and pushing images
# (docs/suggested_deployment.md#the-administrators-grants).

resource "azurerm_user_assigned_identity" "deploy" {
  name                = "${local.prefix}-deploy"
  resource_group_name = local.group
  location            = var.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-${var.env}"
  user_assigned_identity_id = azurerm_user_assigned_identity.deploy.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "repo:${var.github_repository}:environment:${var.env}"
}

data "azurerm_client_config" "current" {}
