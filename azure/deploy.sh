#!/usr/bin/env bash
#
# Deploy monbo-api and monbo-front to Azure Container Apps (test environment).
#
# Usage:
#   ./azure/deploy.sh               # build, push and deploy both services
#   ./azure/deploy.sh --skip-build  # redeploy an image tag that's already in the registry
#   ./azure/deploy.sh storage       # only ensure the persistent layer storage (share, backup, lock)
#   ./azure/deploy.sh seed          # fill the share with the Git layers, per country (empties it first)
#   ./azure/deploy.sh countries list             # the countries on the share and their layers
#   ./azure/deploy.sh countries add|rotate CC    # prints the country's new admin passkey once
#   ./azure/deploy.sh countries disable|enable CC
#   ./azure/deploy.sh countries unlock            # only after an interrupted command
#   ./azure/deploy.sh destroy       # delete the apps' resource group (layer storage is kept)
#
# With STORAGE_ACCOUNT_NAME set, the API reads its layers from an Azure Files share
# mounted at /mnt/maps, in the per-country layout, instead of the ones baked into the
# image. Seed the share first (`seed`, docs/suggested_deployment.md). With
# ADMIN_SESSION_SECRET set, the layers admin is enabled too; each country's passkey
# lives in the share's country registry.
#
# Configuration is read from azure/deploy.env (copy azure/deploy.env.example).
# Any variable can also be overridden from the shell, e.g. `TAG=v2 ./azure/deploy.sh`.
#
# Requirements: az CLI (logged in with `az login`), python3, Docker running, git-lfs,
# and uv for `seed` and `countries`.
# The script is idempotent: it creates missing resources and updates existing ones.

set -euo pipefail

# Silence harmless SyntaxWarnings the Homebrew az CLI (Python 3.14) prints from its own SDK.
export PYTHONWARNINGS="ignore::SyntaxWarning"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$SCRIPT_DIR/deploy.env}"

# Load KEY=VALUE lines from the config file; variables already set in the shell win.
if [ -f "$CONFIG_FILE" ]; then
  # Split on the first '=' by hand: `IFS='=' read key value` drops a single
  # trailing '=', which corrupts base64 values like the Maps signature secret.
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    value="${value%\"}"; value="${value#\"}"
    [ -n "${!key+x}" ] || export "$key=$value"
  done < "$CONFIG_FILE"
fi

# --- Configuration (defaults) ------------------------------------------------

AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-monbo-test}"
LOCATION="${LOCATION:-eastus2}"
ACR_NAME="${ACR_NAME:-}"
CONTAINERAPPS_ENV="${CONTAINERAPPS_ENV:-monbo-env}"
API_APP_NAME="${API_APP_NAME:-monbo-api}"
FRONT_APP_NAME="${FRONT_APP_NAME:-monbo-front}"
TAG="${TAG:-$(git -C "$REPO_ROOT" rev-parse --short HEAD)}"

API_CPU="${API_CPU:-1}"
API_MEMORY="${API_MEMORY:-2Gi}"
FRONT_CPU="${FRONT_CPU:-0.5}"
FRONT_MEMORY="${FRONT_MEMORY:-1Gi}"

OVERLAP_THRESHOLD_PERCENTAGE="${OVERLAP_THRESHOLD_PERCENTAGE:-1}"
DEFORESTATION_THRESHOLD_PERCENTAGE="${DEFORESTATION_THRESHOLD_PERCENTAGE:-1}"
SHOW_TESTING_ENVIRONMENT_WARNING="${SHOW_TESTING_ENVIRONMENT_WARNING:-true}"
MAX_REQUESTS_FOR_SATELLITE_BACKGROUND="${MAX_REQUESTS_FOR_SATELLITE_BACKGROUND:-210}"
# Landing page "Contact us to add your country" button (https: or mailto:); empty hides it.
CONTACT_URL="${CONTACT_URL:-}"

GCP_MAPS_PLATFORM_API_KEY="${GCP_MAPS_PLATFORM_API_KEY:-}"
GCP_MAPS_PLATFORM_SIGNATURE_SECRET="${GCP_MAPS_PLATFORM_SIGNATURE_SECRET:-}"
# The frontend key is exposed to the browser; defaults to the API key if unset.
FRONT_GCP_MAPS_PLATFORM_API_KEY="${FRONT_GCP_MAPS_PLATFORM_API_KEY:-$GCP_MAPS_PLATFORM_API_KEY}"

# Persistent layer storage. Empty STORAGE_ACCOUNT_NAME = the API serves the layers
# baked into its image, as before.
DATA_RESOURCE_GROUP="${DATA_RESOURCE_GROUP:-monbo-data}"
STORAGE_ACCOUNT_NAME="${STORAGE_ACCOUNT_NAME:-}"
MAPS_SHARE_NAME="${MAPS_SHARE_NAME:-maps}"
MAPS_SHARE_QUOTA_GB="${MAPS_SHARE_QUOTA_GB:-10}"
ENV_STORAGE_NAME="${ENV_STORAGE_NAME:-maps}"
BACKUP_VAULT_NAME="${BACKUP_VAULT_NAME:-monbo-backup}"
BACKUP_POLICY_NAME="${BACKUP_POLICY_NAME:-maps-daily-30d}"
DATA_LOCK_NAME="${DATA_LOCK_NAME:-monbo-data-no-delete}"
# Where `seed` writes each country's old id -> new id (for the parity check).
SEED_MAPPING_OUT="${SEED_MAPPING_OUT:-/tmp/monbo-seed-ids.json}"

# Layers admin (optional): a random secret of at least 32 characters that signs the
# admin sessions. Countries and their passkeys: `./azure/deploy.sh countries`.
ADMIN_SESSION_SECRET="${ADMIN_SESSION_SECRET:-}"
# The frontend origin the admin accepts calls from; defaults to the frontend's
# Container Apps URL. Set it when the frontend is served from a custom domain.
ADMIN_ALLOWED_ORIGIN="${ADMIN_ALLOWED_ORIGIN:-}"

# --- Helpers -----------------------------------------------------------------

# Temporary files, some holding secrets: removed however the script exits (a `die`, a
# failed command under `set -e`, Ctrl-C). Add each one right after creating it.
TEMP_FILES=()
remove_temp_files() {
  [ "${#TEMP_FILES[@]}" -eq 0 ] || rm -f "${TEMP_FILES[@]}"
}
trap remove_temp_files EXIT

log() { printf '\n\033[1;34m► %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Pin every az call to AZURE_SUBSCRIPTION_ID so we never deploy into whatever
# subscription happens to be the CLI default.
select_subscription() {
  [ -n "$AZURE_SUBSCRIPTION_ID" ] || die "AZURE_SUBSCRIPTION_ID is required"
  az account show >/dev/null 2>&1 || die "Not logged in to Azure. Run 'az login' first"
  az account set --subscription "$AZURE_SUBSCRIPTION_ID" \
    || die "Cannot access subscription $AZURE_SUBSCRIPTION_ID with the current login"
  ok "Subscription: $(az account show --query name -o tsv) ($AZURE_SUBSCRIPTION_ID)"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed"
}

app_exists() {
  az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$1" >/dev/null 2>&1
}

app_fqdn() {
  az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$1" \
    --query properties.configuration.ingress.fqdn -o tsv
}

layer_storage_enabled() { [ -n "$STORAGE_ACCOUNT_NAME" ]; }
admin_enabled() { [ -n "$ADMIN_SESSION_SECRET" ]; }


storage_key() {
  az storage account keys list -g "$DATA_RESOURCE_GROUP" -n "$STORAGE_ACCOUNT_NAME" \
    --query '[0].value' -o tsv
}

wait_for_health() {
  local url="$1"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "$url is healthy"
      return 0
    fi
    sleep 10
  done
  die "$url did not become healthy. Check logs: az containerapp logs show -g $AZURE_RESOURCE_GROUP -n <app> --follow"
}

# --- Steps -------------------------------------------------------------------

check_prerequisites() {
  log "Checking prerequisites"
  require_cmd az
  require_cmd git
  require_cmd curl
  require_cmd python3
  [ "$SKIP_BUILD" = true ] || [ "$COMMAND" = storage ] || require_cmd docker

  select_subscription

  [ -n "$ACR_NAME" ] || die "ACR_NAME is required (globally unique, lowercase alphanumeric)"
  if [ "$COMMAND" = storage ]; then
    layer_storage_enabled || die "STORAGE_ACCOUNT_NAME is required for the storage command"
  else
    [ -n "$GCP_MAPS_PLATFORM_API_KEY" ] || die "GCP_MAPS_PLATFORM_API_KEY is required"
    [ -n "$GCP_MAPS_PLATFORM_SIGNATURE_SECRET" ] || die "GCP_MAPS_PLATFORM_SIGNATURE_SECRET is required"
    check_admin_config
  fi

  if [ "$SKIP_BUILD" != true ] && [ "$COMMAND" != storage ]; then
    docker info >/dev/null 2>&1 || die "Docker is not running"

    # The rasters are baked into the API image; LFS pointers would ship a broken API.
    check_rasters_are_real
  fi

  az extension add --name containerapp --upgrade --only-show-errors >/dev/null
  register_providers
}

# The API refuses to start with a malformed admin secret; catch it before deploying.
check_admin_config() {
  if ! admin_enabled; then
    ok "Layers admin: disabled (no ADMIN_SESSION_SECRET)"
    return
  fi
  [ "${#ADMIN_SESSION_SECRET}" -ge 32 ] || die "ADMIN_SESSION_SECRET must be at least 32 characters"
  # Without the share, admin changes would land in the container and vanish on restart.
  layer_storage_enabled || die "The layers admin needs persistent storage: set STORAGE_ACCOUNT_NAME"
  ok "Layers admin: enabled"
}

# A fresh subscription has none of these resource providers enabled, and
# registration is asynchronous, so wait until each one reports Registered.
register_providers() {
  local namespace state
  local namespaces=(Microsoft.ContainerRegistry Microsoft.App Microsoft.OperationalInsights)
  layer_storage_enabled && namespaces+=(Microsoft.Storage Microsoft.RecoveryServices)
  for namespace in "${namespaces[@]}"; do
    state="$(az provider show -n "$namespace" --query registrationState -o tsv 2>/dev/null || true)"
    if [ "$state" != "Registered" ]; then
      echo "  Registering $namespace (can take a few minutes)..."
      az provider register -n "$namespace" --wait --only-show-errors \
        || die "Could not register $namespace. You need Contributor or Owner on the subscription"
    fi
    ok "Provider registered: $namespace"
  done
}

ensure_infrastructure() {
  log "Ensuring resource group, registry and Container Apps environment"

  az group create -n "$AZURE_RESOURCE_GROUP" -l "$LOCATION" -o none
  ok "Resource group: $AZURE_RESOURCE_GROUP"

  if ! az acr show -g "$AZURE_RESOURCE_GROUP" -n "$ACR_NAME" >/dev/null 2>&1; then
    az acr create -g "$AZURE_RESOURCE_GROUP" -n "$ACR_NAME" --sku Basic --admin-enabled true -o none
  fi
  ok "Container registry: $ACR_NAME"

  if ! az containerapp env show -g "$AZURE_RESOURCE_GROUP" -n "$CONTAINERAPPS_ENV" >/dev/null 2>&1; then
    az containerapp env create -g "$AZURE_RESOURCE_GROUP" -n "$CONTAINERAPPS_ENV" -l "$LOCATION" -o none
  fi
  ok "Container Apps environment: $CONTAINERAPPS_ENV"

  ACR_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"
  ACR_USERNAME="$(az acr credential show -n "$ACR_NAME" --query username -o tsv)"
  ACR_PASSWORD="$(az acr credential show -n "$ACR_NAME" --query 'passwords[0].value' -o tsv)"
  API_IMAGE="$ACR_SERVER/monbo-api:$TAG"
  FRONT_IMAGE="$ACR_SERVER/monbo-front:$TAG"
}

# The only copy of the layers once they leave Git: its own resource group (so
# `destroy` can't touch it) with a delete lock, share soft delete and daily backups.
ensure_layer_storage() {
  log "Ensuring layer storage: $DATA_RESOURCE_GROUP / $STORAGE_ACCOUNT_NAME / $MAPS_SHARE_NAME"

  az group create -n "$DATA_RESOURCE_GROUP" -l "$LOCATION" --tags app=monbo purpose=layers -o none
  ok "Resource group: $DATA_RESOURCE_GROUP"

  if ! az storage account show -g "$DATA_RESOURCE_GROUP" -n "$STORAGE_ACCOUNT_NAME" >/dev/null 2>&1; then
    az storage account create -g "$DATA_RESOURCE_GROUP" -n "$STORAGE_ACCOUNT_NAME" -l "$LOCATION" \
      --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
      --allow-blob-public-access false --https-only true -o none
  fi
  ok "Storage account: $STORAGE_ACCOUNT_NAME"

  if ! az storage share-rm show -g "$DATA_RESOURCE_GROUP" --storage-account "$STORAGE_ACCOUNT_NAME" \
    -n "$MAPS_SHARE_NAME" >/dev/null 2>&1; then
    az storage share-rm create -g "$DATA_RESOURCE_GROUP" --storage-account "$STORAGE_ACCOUNT_NAME" \
      -n "$MAPS_SHARE_NAME" --quota "$MAPS_SHARE_QUOTA_GB" --enabled-protocols SMB -o none
  fi
  az storage account file-service-properties update -g "$DATA_RESOURCE_GROUP" \
    --account-name "$STORAGE_ACCOUNT_NAME" --enable-delete-retention true \
    --delete-retention-days 14 -o none
  ok "File share: $MAPS_SHARE_NAME (${MAPS_SHARE_QUOTA_GB} GiB, soft delete 14 days)"

  ensure_share_backup

  if ! az lock show -g "$DATA_RESOURCE_GROUP" -n "$DATA_LOCK_NAME" >/dev/null 2>&1; then
    az lock create -g "$DATA_RESOURCE_GROUP" -n "$DATA_LOCK_NAME" --lock-type CanNotDelete \
      --notes "Holds the Monbo layers; remove this lock before deleting anything here" -o none
  fi
  ok "Delete lock: $DATA_LOCK_NAME"

  # Through a body file, not `env storage set` flags: the account key controls the
  # only durable copy of the layers and must not appear on a command line.
  local storage_body
  storage_body="$(mktemp)"
  TEMP_FILES+=("$storage_body")
  STORAGE_ACCOUNT_KEY="$(storage_key)" STORAGE_ACCOUNT_NAME="$STORAGE_ACCOUNT_NAME" \
    MAPS_SHARE_NAME="$MAPS_SHARE_NAME" python3 -c '
import json, os, sys
json.dump({"properties": {"azureFile": {
    "accountName": os.environ["STORAGE_ACCOUNT_NAME"],
    "accountKey": os.environ["STORAGE_ACCOUNT_KEY"],
    "shareName": os.environ["MAPS_SHARE_NAME"],
    "accessMode": "ReadWrite",
}}}, sys.stdout)' > "$storage_body"
  az rest --method put --only-show-errors -o none \
    --url "https://management.azure.com/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP/providers/Microsoft.App/managedEnvironments/$CONTAINERAPPS_ENV/storages/$ENV_STORAGE_NAME?api-version=2024-03-01" \
    --body "@$storage_body"
  rm -f "$storage_body"
  ok "Share registered on $CONTAINERAPPS_ENV as '$ENV_STORAGE_NAME'"
}

# Daily snapshots of the share, kept 30 days, managed by Azure Backup.
ensure_share_backup() {
  if ! az backup vault show -g "$DATA_RESOURCE_GROUP" -n "$BACKUP_VAULT_NAME" >/dev/null 2>&1; then
    az backup vault create -g "$DATA_RESOURCE_GROUP" -n "$BACKUP_VAULT_NAME" -l "$LOCATION" -o none
  fi
  if ! az backup policy show -g "$DATA_RESOURCE_GROUP" -v "$BACKUP_VAULT_NAME" \
    -n "$BACKUP_POLICY_NAME" >/dev/null 2>&1; then
    local policy
    policy="$(mktemp)"
    cat > "$policy" <<'POLICY'
{
  "properties": {
    "backupManagementType": "AzureStorage",
    "workLoadType": "AzureFileShare",
    "schedulePolicy": {
      "schedulePolicyType": "SimpleSchedulePolicy",
      "scheduleRunFrequency": "Daily",
      "scheduleRunTimes": ["2026-01-01T06:00:00Z"]
    },
    "retentionPolicy": {
      "retentionPolicyType": "LongTermRetentionPolicy",
      "dailySchedule": {
        "retentionTimes": ["2026-01-01T06:00:00Z"],
        "retentionDuration": {"count": 30, "durationType": "Days"}
      }
    },
    "timeZone": "UTC"
  }
}
POLICY
    az backup policy create -g "$DATA_RESOURCE_GROUP" -v "$BACKUP_VAULT_NAME" -n "$BACKUP_POLICY_NAME" \
      --backup-management-type AzureStorage --workload-type AzureFileShare \
      --policy "@$policy" -o none
    rm -f "$policy"
  fi
  local protected
  protected="$(az backup item list -g "$DATA_RESOURCE_GROUP" -v "$BACKUP_VAULT_NAME" \
    --backup-management-type AzureStorage --workload-type AzureFileShare \
    --query "[?properties.friendlyName=='$MAPS_SHARE_NAME'] | length(@)" -o tsv)"
  if [ "$protected" = "0" ]; then
    az backup protection enable-for-azurefileshare -g "$DATA_RESOURCE_GROUP" -v "$BACKUP_VAULT_NAME" \
      --storage-account "$STORAGE_ACCOUNT_NAME" --azure-file-share "$MAPS_SHARE_NAME" \
      --policy-name "$BACKUP_POLICY_NAME" -o none
  fi
  ok "Backup: $BACKUP_VAULT_NAME / $BACKUP_POLICY_NAME (daily, 30 days)"
}

# Whether a file exists on the share. Dies when az itself fails (network, storage
# firewall, shared-key access disabled): that is not the same as an unseeded share, and
# seeding a share that already holds admin-created layers would overwrite them.
share_file_exists() {
  local key exists
  key="$(storage_key)" || die "Could not read the key of storage account $STORAGE_ACCOUNT_NAME"
  # The key goes through the environment, not argv (visible in `ps`).
  exists="$(AZURE_STORAGE_KEY="$key" az storage file exists --account-name "$STORAGE_ACCOUNT_NAME" \
    --share-name "$MAPS_SHARE_NAME" --path "$1" --query exists -o tsv --only-show-errors)" \
    || die "Could not check the '$MAPS_SHARE_NAME' share for $1 (see the az error above)"
  [ "$exists" = "true" ]
}

# The share holds the per-country layout: its country registry.
share_has_layers() { share_file_exists countries.json; }

check_rasters_are_real() {
  local raster
  for raster in "$REPO_ROOT"/monbo-api/app/maps/layers/rasters/*.tif; do
    if head -c 100 "$raster" | grep -q "git-lfs.github.com/spec"; then
      die "$(basename "$raster") is a Git LFS pointer. Run 'git lfs pull' first"
    fi
  done
  ok "Rasters are real files (not LFS pointers)"
}

build_and_push() {
  log "Building and pushing images (tag: $TAG)"
  az acr login -n "$ACR_NAME"

  docker build --platform linux/amd64 -f "$REPO_ROOT/monbo-api/Dockerfile.prod" \
    -t "$API_IMAGE" "$REPO_ROOT/monbo-api"
  docker push "$API_IMAGE"
  ok "Pushed $API_IMAGE"

  docker build --platform linux/amd64 -f "$REPO_ROOT/monbo-front/Dockerfile.prod" \
    -t "$FRONT_IMAGE" "$REPO_ROOT/monbo-front"
  docker push "$FRONT_IMAGE"
  ok "Pushed $FRONT_IMAGE"
}

# The API app is PUT whole from render_api_app.py: flags can't add volumes, and
# `az containerapp update --yaml` is broken on az CLI 2.90. The PUT replaces the app:
# render_api_app.py owns its container, env vars, secrets, registry and scale, so an
# env var, secret or scale rule added in the portal is dropped on the next deploy. Custom
# domains, IP restrictions, CORS, identity, tags and the workload profile are kept.
deploy_api() {
  log "Deploying $API_APP_NAME"
  local mount=false
  if layer_storage_enabled; then
    # Mounting an empty folder would leave the API without layers.
    share_has_layers || die "The '$MAPS_SHARE_NAME' share has no countries.json: seed it first with ./azure/deploy.sh seed"
    mount=true
  fi

  local env_id default_domain body existing previous_revision="" admin_origin
  env_id="$(az containerapp env show -g "$AZURE_RESOURCE_GROUP" -n "$CONTAINERAPPS_ENV" --query id -o tsv)"
  default_domain="$(az containerapp env show -g "$AZURE_RESOURCE_GROUP" -n "$CONTAINERAPPS_ENV" \
    --query properties.defaultDomain -o tsv)"
  admin_origin="${ADMIN_ALLOWED_ORIGIN:-https://$FRONT_APP_NAME.$default_domain}"
  body="$(mktemp)"
  existing="$(mktemp)"
  TEMP_FILES+=("$body" "$existing")
  # Settings configured outside this script that the PUT must not drop.
  if app_exists "$API_APP_NAME"; then
    az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" -o json > "$existing"
    previous_revision="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["properties"].get("latestRevisionName") or "")' "$existing")"
  else
    echo '{}' > "$existing"
  fi
  LOCATION="$LOCATION" ENV_ID="$env_id" API_IMAGE="$API_IMAGE" API_CPU="$API_CPU" API_MEMORY="$API_MEMORY" \
    ACR_SERVER="$ACR_SERVER" ACR_USERNAME="$ACR_USERNAME" ACR_PASSWORD="$ACR_PASSWORD" \
    GCP_MAPS_PLATFORM_API_KEY="$GCP_MAPS_PLATFORM_API_KEY" \
    GCP_MAPS_PLATFORM_SIGNATURE_SECRET="$GCP_MAPS_PLATFORM_SIGNATURE_SECRET" \
    OVERLAP_THRESHOLD_PERCENTAGE="$OVERLAP_THRESHOLD_PERCENTAGE" \
    MAPS_MOUNT="$mount" ENV_STORAGE_NAME="$ENV_STORAGE_NAME" \
    ADMIN_SESSION_SECRET="$ADMIN_SESSION_SECRET" \
    ADMIN_ALLOWED_ORIGIN="$admin_origin" \
    EXISTING_APP_FILE="$existing" \
    python3 "$SCRIPT_DIR/render_api_app.py" > "$body"

  az rest --method put --only-show-errors -o none \
    --url "https://management.azure.com/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP/providers/Microsoft.App/containerApps/$API_APP_NAME?api-version=2024-03-01" \
    --body "@$body"
  # The body carries secrets and nothing needs it anymore.
  rm -f "$body" "$existing"
  wait_for_provisioning "$API_APP_NAME"
  local revision
  revision="$(wait_for_latest_revision "$API_APP_NAME")"
  # Secrets are only read at container start. A new revision already started with the
  # current ones; otherwise restart so a changed secret takes effect. (A needless
  # restart would bounce the only replica and interrupt an ingestion.)
  if [ "$revision" = "$previous_revision" ]; then
    az containerapp revision restart -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" \
      --revision "$revision" -o none
  fi

  API_URL="https://$(app_fqdn "$API_APP_NAME")"
  wait_for_health "$API_URL/health"
  [ "$mount" = true ] && verify_maps_root "$API_URL"
  admin_enabled && ok "Layers admin: $admin_origin/admin"
  return 0
}

wait_for_provisioning() {
  local state
  for _ in $(seq 1 60); do
    state="$(az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$1" --query properties.provisioningState -o tsv)"
    case "$state" in
      Succeeded) return 0 ;;
      Failed) die "$1 failed to provision. Check: az containerapp revision list -g $AZURE_RESOURCE_GROUP -n $1" ;;
    esac
    sleep 5
  done
  die "$1 is still provisioning ($state)"
}

# Provisioning succeeds before a new revision is ready, and until then the previous
# revision keeps serving; wait for the latest one and print its name.
wait_for_latest_revision() {
  local latest ready
  for _ in $(seq 1 60); do
    read -r latest ready < <(az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$1" \
      --query "[properties.latestRevisionName, properties.latestReadyRevisionName]" -o tsv | paste -s -)
    if [ -n "$latest" ] && [ "$latest" = "$ready" ]; then
      echo "$latest"
      return 0
    fi
    sleep 10
  done
  die "Revision $latest of $1 did not become ready. Check: az containerapp logs show -g $AZURE_RESOURCE_GROUP -n $1 --revision $latest"
}

# The API must read (and, for the admin, write) the share, not the image's copy.
# Retries for a while: the previous revision can still answer while it drains.
verify_maps_root() {
  local health report="" expected=/mnt/maps
  for _ in $(seq 1 12); do
    health="$(curl -fsS "$1/health" 2>/dev/null || true)"
    if report="$(python3 -c '
import json, sys
try:
    health = json.loads(sys.argv[1])
except ValueError:
    sys.exit("no answer from /health")
root, writable = health.get("mapsRoot"), health.get("mapsRootWritable")
if root != sys.argv[2] or not writable:
    sys.exit("API reports mapsRoot=%s writable=%s" % (root, writable))
' "$health" "$expected" 2>&1)"; then
      ok "API reads its layers from $expected (writable)"
      return 0
    fi
    sleep 10
  done
  echo "  $report" >&2
  die "The API does not read a writable $expected (check the mount options and the image uid)"
}

deploy_front() {
  log "Deploying $FRONT_APP_NAME"
  local env_vars=(
    "NEXT_PUBLIC_API_URL=$API_URL"
    "NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=$FRONT_GCP_MAPS_PLATFORM_API_KEY"
    "NEXT_PUBLIC_OVERLAP_THRESHOLD_PERCENTAGE=$OVERLAP_THRESHOLD_PERCENTAGE"
    "NEXT_PUBLIC_DEFORESTATION_THRESHOLD_PERCENTAGE=$DEFORESTATION_THRESHOLD_PERCENTAGE"
    "NEXT_PUBLIC_SHOW_TESTING_ENVIRONMENT_WARNING=$SHOW_TESTING_ENVIRONMENT_WARNING"
    "NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION=$MAX_REQUESTS_FOR_SATELLITE_BACKGROUND"
    "NEXT_PUBLIC_CONTACT_URL=$CONTACT_URL"
  )

  if app_exists "$FRONT_APP_NAME"; then
    az containerapp update -g "$AZURE_RESOURCE_GROUP" -n "$FRONT_APP_NAME" \
      --image "$FRONT_IMAGE" --cpu "$FRONT_CPU" --memory "$FRONT_MEMORY" \
      --set-env-vars "${env_vars[@]}" -o none
  else
    az containerapp create -g "$AZURE_RESOURCE_GROUP" -n "$FRONT_APP_NAME" \
      --environment "$CONTAINERAPPS_ENV" --image "$FRONT_IMAGE" \
      --registry-server "$ACR_SERVER" --registry-username "$ACR_USERNAME" --registry-password "$ACR_PASSWORD" \
      --target-port 3000 --ingress external \
      --cpu "$FRONT_CPU" --memory "$FRONT_MEMORY" --min-replicas 1 --max-replicas 1 \
      --env-vars "${env_vars[@]}" -o none
  fi

  FRONT_URL="https://$(app_fqdn "$FRONT_APP_NAME")"
  wait_for_health "$FRONT_URL/api/health"
}

# Dies when az fails, which must not be mistaken for an empty share.
share_is_empty() {
  local count
  count="$(AZURE_STORAGE_KEY="$1" az storage file list --account-name "$STORAGE_ACCOUNT_NAME" \
    --share-name "$MAPS_SHARE_NAME" --num-results 1 --query 'length(@)' -o tsv --only-show-errors)" \
    || die "Could not list the '$MAPS_SHARE_NAME' share (see the az error above)"
  [ "$count" = "0" ]
}

# Fills the share with the Git-tracked layers (monbo-api/app/maps, needs `git lfs
# pull`) in the per-country layout, for a new environment or to start an environment
# over. Every raster is validated and converted to a Cloud Optimized GeoTIFF (the
# seed command), then split by country (the migration command, which prints one admin
# passkey per country). A share that already has files is emptied first, after typing
# its name: every layer and admin change on it is lost. Deploy right after, so the API
# reads the new layout.
seed_share() {
  local key tmp answer
  layer_storage_enabled || die "'seed' needs STORAGE_ACCOUNT_NAME"
  require_cmd az
  require_cmd uv
  select_subscription
  check_rasters_are_real

  key="$(storage_key)"
  if ! share_is_empty "$key"; then
    log "The '$MAPS_SHARE_NAME' share already has files"
    echo "  All of them will be deleted: every layer, raster version and admin change on it."
    echo "  (Share snapshots and backups are kept: docs/suggested_deployment.md.)"
    read -r -p "Type the share name to confirm: " answer
    [ "$answer" = "$MAPS_SHARE_NAME" ] || die "Aborted; the share is unchanged"
  fi

  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"; trap - RETURN' RETURN
  log "Preparing the layers (validation and COG conversion take a few minutes)"
  uv run --quiet --directory "$REPO_ROOT/monbo-api" python -m app.modules.layers.seed \
    --target "$tmp/flat" || die "Seeding failed; the share is unchanged"
  uv run --quiet --directory "$REPO_ROOT/monbo-api" python -m app.modules.layers.migrate_countries \
    --source "$tmp/flat" --target "$tmp/layers" --mapping-out "$SEED_MAPPING_OUT" \
    || die "The per-country migration failed; the share is unchanged"
  echo "  Put each passkey above in the password manager now: it is not stored anywhere."
  echo "  Old id -> new id per country, for tests.regression.parity --mapping: $SEED_MAPPING_OUT"

  # Only now, with the new layers ready, empty the share.
  if ! share_is_empty "$key"; then
    log "Emptying the '$MAPS_SHARE_NAME' share"
    AZURE_STORAGE_KEY="$key" az storage file delete-batch --account-name "$STORAGE_ACCOUNT_NAME" \
      --source "$MAPS_SHARE_NAME" -o none
  fi
  log "Uploading the layers"
  AZURE_STORAGE_KEY="$key" az storage file upload-batch --account-name "$STORAGE_ACCOUNT_NAME" \
    --destination "$MAPS_SHARE_NAME" --source "$tmp/layers" -o none
  ok "The share has the per-country layers. Deploy now so the API reads them: ./azure/deploy.sh"
}

# Runs the country registry command (app.modules.admin.countries) against the share
# without redeploying: the registry (and, for `list`, each country's index) is
# downloaded to a temporary folder, the command runs there, and only what changed is
# uploaded. A lease protects the ETag check and upload from concurrent operators.
# The API picks the new registry up on its next request.
countries() {
  local command="${1:-}" code key tmp etag listed output answer
  code="$(printf '%s' "${2:-}" | tr '[:lower:]' '[:upper:]')"
  case "$command" in
    list|add|rotate|disable|enable|unlock) ;;
    *) die "Usage: ./azure/deploy.sh countries list|add|rotate|disable|enable [CC] or unlock" ;;
  esac
  [ "$command" = list ] || [ "$command" = unlock ] || [ -n "$code" ] \
    || die "'countries $command' needs a country code"
  layer_storage_enabled || die "'countries' needs STORAGE_ACCOUNT_NAME"
  require_cmd az
  require_cmd uv
  select_subscription

  key="$(storage_key)"
  if [ "$command" = unlock ]; then
    echo "  Only break the lease after confirming no country command is running."
    read -r -p "Type unlock to continue: " answer
    [ "$answer" = unlock ] || die "Aborted; the lease is unchanged"
    AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/monbo-api" \
      python -m app.modules.admin.azure_registry break-stale-lease \
      --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME"
    ok "Country registry lease released"
    return 0
  fi
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"; trap - RETURN' RETURN
  etag="$(AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/monbo-api" \
    python -m app.modules.admin.azure_registry snapshot \
    --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME" \
    --dest "$tmp/countries.json")" \
    || die "Cannot read countries.json from the share; seed it first if it is empty"
  if [ "$command" = list ]; then
    for listed in $(python3 -c 'import json, sys
print(" ".join(c["code"] for c in json.load(open(sys.argv[1]))["countries"]))' "$tmp/countries.json"); do
      mkdir -p "$tmp/$listed"
      AZURE_STORAGE_KEY="$key" az storage file download --account-name "$STORAGE_ACCOUNT_NAME" \
        --share-name "$MAPS_SHARE_NAME" --path "$listed/index.json" \
        --dest "$tmp/$listed/index.json" -o none 2>/dev/null || true
    done
  fi

  output="$(uv run --quiet --group azure --directory "$REPO_ROOT/monbo-api" python -m app.modules.admin.countries \
    "$command" ${code:+"$code"} --root "$tmp")" \
    || die "'countries $command' failed; nothing was uploaded"
  if [ "$command" = list ]; then
    printf '%s\n' "$output"
    return 0
  fi

  if [ "$command" = add ]; then
    AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/monbo-api" \
      python -m app.modules.admin.azure_registry publish \
      --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME" \
      --expected-etag "$etag" --source "$tmp/countries.json" \
      --country "$code" --country-index "$tmp/$code/index.json" \
      || die "The country was not registered; run the command again"
  else
    AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/monbo-api" \
      python -m app.modules.admin.azure_registry publish \
      --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME" \
      --expected-etag "$etag" --source "$tmp/countries.json" \
      || die "The registry was not updated; run the command again"
  fi
  printf '%s\n' "$output"
  ok "Updated countries.json on the share; the API applies it on its next request"
}

destroy() {
  require_cmd az
  select_subscription
  log "Deleting resource group '$AZURE_RESOURCE_GROUP' and everything in it"
  read -r -p "Type the resource group name to confirm: " answer
  [ "$answer" = "$AZURE_RESOURCE_GROUP" ] || die "Aborted"
  az group delete -n "$AZURE_RESOURCE_GROUP" --yes --no-wait
  ok "Deletion started (runs in the background on Azure)"
  echo "  The layer storage in '$DATA_RESOURCE_GROUP' is kept (it has a delete lock)."
}

# --- Main --------------------------------------------------------------------

SKIP_BUILD=false
COMMAND=deploy
COUNTRY_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    destroy) COMMAND=destroy ;;
    storage) COMMAND=storage ;;
    seed) COMMAND=seed ;;
    countries) COMMAND=countries ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *)
      if [ "$COMMAND" = countries ]; then
        COUNTRY_ARGS+=("$arg")
      else
        die "Unknown argument: $arg (see --help)"
      fi
      ;;
  esac
done

if [ "$COMMAND" = destroy ]; then
  destroy
  exit 0
fi
if [ "$COMMAND" = seed ]; then
  seed_share
  exit 0
fi
if [ "$COMMAND" = countries ]; then
  # (the +-expansion keeps bash 3.2's `set -u` happy with an empty array)
  countries ${COUNTRY_ARGS[@]+"${COUNTRY_ARGS[@]}"}
  exit 0
fi

check_prerequisites
ensure_infrastructure
layer_storage_enabled && ensure_layer_storage
if [ "$COMMAND" = storage ]; then
  log "Done"
  share_has_layers && echo "  The share has its layers (countries.json)." \
    || echo "  The share has no layers yet: run ./azure/deploy.sh seed before deploying with the mount."
  exit 0
fi
[ "$SKIP_BUILD" = true ] || build_and_push
deploy_api
deploy_front

log "Done"
echo "  Frontend: $FRONT_URL"
echo "  API:      $API_URL  (docs: $API_URL/docs)"
echo "  Tag:      $TAG"
