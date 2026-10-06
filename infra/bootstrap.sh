#!/usr/bin/env bash
#
# Create the storage account that holds the Terraform state. Once per subscription,
# before the first `terraform init` of any environment.
#
# Usage:
#   ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh [state-account-name] [location]
#
# The subscription comes from ARM_SUBSCRIPTION_ID, like everywhere else (it is kept out
# of the repository). The account name defaults to monbotfstate.
#
# The account has shared-key access disabled: Terraform reads and writes the state
# with the operator's Entra identity (backends use `use_azuread_auth`), so no account
# key exists to leak, and no local Terraform state holds one (which is why this is a
# script and not a Terraform stack). Blob versioning and soft delete keep earlier
# states recoverable. The signed-in user gets Storage Blob Data Contributor on it;
# grant the same role to other operators and, later, to the deploy identity.
#
# Idempotent: it creates what is missing and leaves the rest.

set -euo pipefail

export PYTHONWARNINGS="ignore::SyntaxWarning"

log() { printf '\n\033[1;34m► %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

SUBSCRIPTION_ID="${ARM_SUBSCRIPTION_ID:-}"
[ -n "$SUBSCRIPTION_ID" ] || die "Set ARM_SUBSCRIPTION_ID (usage: ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh [state-account-name] [location])"
ACCOUNT="${1:-monbotfstate}"
LOCATION="${2:-eastus2}"
RESOURCE_GROUP="${STATE_RESOURCE_GROUP:-monbo-tfstate}"
CONTAINER="tfstate"

[[ "$ACCOUNT" =~ ^[a-z0-9]{3,24}$ ]] || die "The account name must be 3-24 lowercase letters or digits"
command -v az >/dev/null 2>&1 || die "'az' is not installed"
az account show >/dev/null 2>&1 || die "Not logged in to Azure. Run 'az login' first"
az account set --subscription "$SUBSCRIPTION_ID" || die "Cannot access the subscription in ARM_SUBSCRIPTION_ID"
ok "Subscription: $(az account show --query name -o tsv)"

log "State account $RESOURCE_GROUP / $ACCOUNT"
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" --tags app=monbo purpose=terraform-state -o none
if ! az storage account show -g "$RESOURCE_GROUP" -n "$ACCOUNT" >/dev/null 2>&1; then
  az storage account create -g "$RESOURCE_GROUP" -n "$ACCOUNT" -l "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access false --https-only true -o none
fi
az storage account blob-service-properties update -g "$RESOURCE_GROUP" --account-name "$ACCOUNT" \
  --enable-versioning true --enable-delete-retention true --delete-retention-days 30 \
  --enable-container-delete-retention true --container-delete-retention-days 30 -o none
ok "Storage account (no shared keys, versioning, 30-day soft delete)"

account_id="$(az storage account show -g "$RESOURCE_GROUP" -n "$ACCOUNT" --query id -o tsv)"
user_id="$(az ad signed-in-user show --query id -o tsv)"
if [ -z "$(az role assignment list --assignee "$user_id" --scope "$account_id" \
  --role "Storage Blob Data Contributor" --query '[].id' -o tsv)" ]; then
  az role assignment create --assignee-object-id "$user_id" --assignee-principal-type User \
    --role "Storage Blob Data Contributor" --scope "$account_id" -o none
fi
ok "Storage Blob Data Contributor for the signed-in user"

# A new role assignment takes a minute or two to apply to data-plane calls.
for _ in $(seq 1 18); do
  if az storage container create --account-name "$ACCOUNT" -n "$CONTAINER" --auth-mode login \
    -o none --only-show-errors 2>/dev/null; then
    break
  fi
  sleep 10
done
az storage container show --account-name "$ACCOUNT" -n "$CONTAINER" --auth-mode login -o none \
  || die "Could not create the '$CONTAINER' container (the role may still be propagating; run again)"
ok "Container: $CONTAINER"

log "Done"
if [ "$ACCOUNT" != monbotfstate ] || [ "$RESOURCE_GROUP" != monbo-tfstate ]; then
  echo "  You used a non-default name: update infra/terraform/{platform,apps}/envs/*.backend.hcl"
  echo "  (resource_group_name = \"$RESOURCE_GROUP\", storage_account_name = \"$ACCOUNT\") and"
  echo "  state_storage_account_name in infra/terraform/apps/envs/*.tfvars."
fi
