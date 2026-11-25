#!/usr/bin/env bash
#
# Prepare an environment's resource group and the storage account that holds its
# Terraform state. Once per environment, before the first `terraform init`.
#
# Usage:
#   ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh <resource-group> <state-account> [location]
#   ARM_SUBSCRIPTION_ID=<dev id>  ./infra/bootstrap.sh monbo-dev monbodevtfstate eastus
#   ARM_SUBSCRIPTION_ID=<prod id> ./infra/bootstrap.sh "$TF_VAR_resource_group_name" monboprodtfstate eastus
#
# The subscription comes from ARM_SUBSCRIPTION_ID, like everywhere else (it is kept out
# of the repository). Each environment names the same group and account in
# infra/terraform/{platform,apps}/envs/<env>.backend.hcl and its tfvars.
#
# Every environment lives in one resource group (docs/suggested_deployment.md). A group
# that already exists (prod's, granted by UNDP) is used as it is: never retagged or
# locked. A missing one (dev's) is created, which needs that right in the subscription.
#
# The state account keeps its key: the operators may only hold Contributor on the
# group, which can't grant a data role on the account, so the backends read the state
# with the key (infra/lib.sh exports it as ARM_ACCESS_KEY; nothing writes it to disk).
# Blob versioning and soft delete keep earlier states recoverable. Nothing here needs
# more than Contributor on an existing group.
#
# Idempotent: it creates what is missing and leaves the rest.

set -euo pipefail

export PYTHONWARNINGS="ignore::SyntaxWarning"

log() { printf '\n\033[1;34m► %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

USAGE="usage: ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh <resource-group> <state-account> [location]"
SUBSCRIPTION_ID="${ARM_SUBSCRIPTION_ID:-}"
[ -n "$SUBSCRIPTION_ID" ] || die "Set ARM_SUBSCRIPTION_ID ($USAGE)"
RESOURCE_GROUP="${1:-}"
ACCOUNT="${2:-}"
LOCATION="${3:-eastus}"
CONTAINER="tfstate"

[ -n "$RESOURCE_GROUP" ] && [ -n "$ACCOUNT" ] || die "$USAGE"
[[ "$ACCOUNT" =~ ^[a-z0-9]{3,24}$ ]] || die "The account name must be 3-24 lowercase letters or digits"
command -v az >/dev/null 2>&1 || die "'az' is not installed"
az account show >/dev/null 2>&1 || die "Not logged in to Azure. Run 'az login' first"
az account set --subscription "$SUBSCRIPTION_ID" || die "Cannot access the subscription in ARM_SUBSCRIPTION_ID"
ok "Subscription: $(az account show --query name -o tsv)"

log "Resource group $RESOURCE_GROUP"
# `az group create` on an existing group would overwrite its tags, and it may not be ours.
if az group show -n "$RESOURCE_GROUP" -o none 2>/dev/null; then
  ok "Using the existing group"
else
  az group create -n "$RESOURCE_GROUP" -l "$LOCATION" --tags app=monbo -o none \
    || die "Could not create the group (creating one needs rights in the subscription; ask for it to be created)"
  ok "Created in $LOCATION"
fi

log "State account $ACCOUNT"
if ! az storage account show -g "$RESOURCE_GROUP" -n "$ACCOUNT" >/dev/null 2>&1; then
  az storage account create -g "$RESOURCE_GROUP" -n "$ACCOUNT" -l "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access true --https-only true \
    --tags app=monbo purpose=terraform-state -o none
fi
az storage account blob-service-properties update -g "$RESOURCE_GROUP" --account-name "$ACCOUNT" \
  --enable-versioning true --enable-delete-retention true --delete-retention-days 30 \
  --enable-container-delete-retention true --container-delete-retention-days 30 -o none
ok "Storage account (versioning, 30-day soft delete)"

key="$(az storage account keys list -g "$RESOURCE_GROUP" -n "$ACCOUNT" --query '[0].value' -o tsv)"
# The key goes through the environment, not argv (visible in `ps`).
AZURE_STORAGE_KEY="$key" az storage container create --account-name "$ACCOUNT" -n "$CONTAINER" \
  --auth-mode key -o none --only-show-errors \
  || die "Could not create the '$CONTAINER' container"
ok "Container: $CONTAINER"

log "Done"
echo "  The environment names the group in TF_VAR_resource_group_name (infra/envs/<env>.secrets.env"
echo "  and the GitHub Environment), and the account in infra/terraform/{platform,apps}/envs/<env>.backend.hcl"
echo "  (storage_account_name = \"$ACCOUNT\") and state_storage_account_name in apps/envs/<env>.tfvars."
