terraform {
  required_version = ">= 1.16.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.8"
    }
  }

  # Filled per environment: terraform init -backend-config=envs/<env>.backend.hcl.
  # The state is read with the state account's key, which infra/lib.sh exports as
  # ARM_ACCESS_KEY (the operators may not be granted a data role on the account).
  backend "azurerm" {}
}

# The subscription comes from ARM_SUBSCRIPTION_ID (infra/envs/<env>.secrets.env, or the
# GitHub Environment in CI), not from the repository.
provider "azurerm" {
  features {}

  # Register only what this environment uses, instead of the provider's default set.
  resource_provider_registrations = "none"
  resource_providers_to_register = [
    "Microsoft.App",
    "Microsoft.ContainerRegistry",
    "Microsoft.ManagedIdentity",
    "Microsoft.OperationalInsights",
    "Microsoft.RecoveryServices",
    "Microsoft.Storage",
  ]
}
