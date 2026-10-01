#!/usr/bin/env bash
#
# Deploy monbo-api and monbo-front to Azure Container Apps (test environment).
#
# Usage:
#   ./azure/deploy.sh               # build, push and deploy both services
#   ./azure/deploy.sh --skip-build  # redeploy an image tag that's already in the registry
#   ./azure/deploy.sh storage       # only ensure the persistent layer storage (share, backup, lock)
#   ./azure/deploy.sh destroy       # delete the apps' resource group (layer storage is kept)
#
# With STORAGE_ACCOUNT_NAME set, the API reads its layers from an Azure Files share
# mounted at /mnt/maps instead of the ones baked into the image; seed the share first
# (docs/suggested_deployment.md). With ADMIN_PASSKEY_HASH and ADMIN_SESSION_SECRET set,
# the layers admin is enabled too.
#
# Configuration is read from azure/deploy.env (copy azure/deploy.env.example).
# Any variable can also be overridden from the shell, e.g. `TAG=v2 ./azure/deploy.sh`.
#
# Requirements: az CLI (logged in with `az login`), python3, Docker running, git-lfs.
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

# Layers admin (optional): generate both with `uv run python -m app.modules.admin.passkey`.
ADMIN_PASSKEY_HASH="${ADMIN_PASSKEY_HASH:-}"
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
admin_enabled() { [ -n "$ADMIN_PASSKEY_HASH" ] && [ -n "$ADMIN_SESSION_SECRET" ]; }

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
    local raster
    for raster in "$REPO_ROOT"/monbo-api/app/maps/layers/rasters/*.tif; do
      if head -c 100 "$raster" | grep -q "git-lfs.github.com/spec"; then
        die "$(basename "$raster") is a Git LFS pointer. Run 'git lfs pull' first"
      fi
    done
    ok "Rasters are real files (not LFS pointers)"
  fi

  az extension add --name containerapp --upgrade --only-show-errors >/dev/null
  register_providers
}

# The API refuses to start with a malformed admin secret; catch it before deploying.
check_admin_config() {
  if [ -z "$ADMIN_PASSKEY_HASH$ADMIN_SESSION_SECRET" ]; then
    ok "Layers admin: disabled (no ADMIN_* secrets)"
    return
  fi
  admin_enabled || die "Set both ADMIN_PASSKEY_HASH and ADMIN_SESSION_SECRET, or neither"
  [[ "$ADMIN_PASSKEY_HASH" =~ ^[0-9a-f]{64}$ ]] \
    || die "ADMIN_PASSKEY_HASH must be a SHA-256 in lowercase hex (64 characters)"
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

# Whether the share has an index.json. Dies when az itself fails (network, storage
# firewall, shared-key access disabled): that is not the same as an unseeded share, and
# seeding a share that already holds admin-created layers would overwrite them.
share_has_index() {
  local key exists
  key="$(storage_key)" || die "Could not read the key of storage account $STORAGE_ACCOUNT_NAME"
  # The key goes through the environment, not argv (visible in `ps`).
  exists="$(AZURE_STORAGE_KEY="$key" az storage file exists --account-name "$STORAGE_ACCOUNT_NAME" \
    --share-name "$MAPS_SHARE_NAME" --path index.json --query exists -o tsv --only-show-errors)" \
    || die "Could not check the '$MAPS_SHARE_NAME' share for index.json (see the az error above)"
  [ "$exists" = "true" ]
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
    # Mounting an empty share would leave the API without layers.
    share_has_index || die "The '$MAPS_SHARE_NAME' share has no index.json: seed it first (docs/suggested_deployment.md)"
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
    ADMIN_PASSKEY_HASH="$ADMIN_PASSKEY_HASH" ADMIN_SESSION_SECRET="$ADMIN_SESSION_SECRET" \
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
  local health report=""
  for _ in $(seq 1 12); do
    health="$(curl -fsS "$1/health" 2>/dev/null || true)"
    if report="$(python3 -c '
import json, sys
try:
    health = json.loads(sys.argv[1])
except ValueError:
    sys.exit("no answer from /health")
root, writable = health.get("mapsRoot"), health.get("mapsRootWritable")
if root != "/mnt/maps" or not writable:
    sys.exit("API reports mapsRoot=%s writable=%s" % (root, writable))
' "$health" 2>&1)"; then
      ok "API reads its layers from /mnt/maps (writable)"
      return 0
    fi
    sleep 10
  done
  echo "  $report" >&2
  die "The share is not mounted writable at /mnt/maps (check the mount options and the image uid)"
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
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    destroy) COMMAND=destroy ;;
    storage) COMMAND=storage ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) die "Unknown argument: $arg (see --help)" ;;
  esac
done

if [ "$COMMAND" = destroy ]; then
  destroy
  exit 0
fi

check_prerequisites
ensure_infrastructure
layer_storage_enabled && ensure_layer_storage
if [ "$COMMAND" = storage ]; then
  log "Done"
  share_has_index && echo "  The share has an index.json." \
    || echo "  The share is empty: seed it before deploying with the mount (docs/suggested_deployment.md)."
  exit 0
fi
[ "$SKIP_BUILD" = true ] || build_and_push
deploy_api
deploy_front

log "Done"
echo "  Frontend: $FRONT_URL"
echo "  API:      $API_URL  (docs: $API_URL/docs)"
echo "  Tag:      $TAG"
