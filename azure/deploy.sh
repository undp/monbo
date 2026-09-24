#!/usr/bin/env bash
#
# Deploy monbo-api and monbo-front to Azure Container Apps (test environment).
#
# Usage:
#   ./azure/deploy.sh               # build, push and deploy both services
#   ./azure/deploy.sh --skip-build  # redeploy an image tag that's already in the registry
#   ./azure/deploy.sh destroy       # delete the whole resource group
#
# Configuration is read from azure/deploy.env (copy azure/deploy.env.example).
# Any variable can also be overridden from the shell, e.g. `TAG=v2 ./azure/deploy.sh`.
#
# Requirements: az CLI (logged in with `az login`), Docker running, git-lfs.
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

# --- Helpers -----------------------------------------------------------------

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
  [ "$SKIP_BUILD" = true ] || require_cmd docker

  select_subscription

  [ -n "$ACR_NAME" ] || die "ACR_NAME is required (globally unique, lowercase alphanumeric)"
  [ -n "$GCP_MAPS_PLATFORM_API_KEY" ] || die "GCP_MAPS_PLATFORM_API_KEY is required"
  [ -n "$GCP_MAPS_PLATFORM_SIGNATURE_SECRET" ] || die "GCP_MAPS_PLATFORM_SIGNATURE_SECRET is required"

  if [ "$SKIP_BUILD" != true ]; then
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

# A fresh subscription has none of these resource providers enabled, and
# registration is asynchronous, so wait until each one reports Registered.
register_providers() {
  local namespace state
  for namespace in Microsoft.ContainerRegistry Microsoft.App Microsoft.OperationalInsights; do
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

deploy_api() {
  log "Deploying $API_APP_NAME"
  local env_vars=(
    "GCP_MAPS_PLATFORM_API_KEY=secretref:gmaps-api-key"
    "GCP_MAPS_PLATFORM_SIGNATURE_SECRET=secretref:gmaps-signature-secret"
    "OVERLAP_THRESHOLD_PERCENTAGE=$OVERLAP_THRESHOLD_PERCENTAGE"
  )
  local secrets=(
    "gmaps-api-key=$GCP_MAPS_PLATFORM_API_KEY"
    "gmaps-signature-secret=$GCP_MAPS_PLATFORM_SIGNATURE_SECRET"
  )

  if app_exists "$API_APP_NAME"; then
    az containerapp secret set -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" --secrets "${secrets[@]}" -o none
    az containerapp update -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" \
      --image "$API_IMAGE" --cpu "$API_CPU" --memory "$API_MEMORY" \
      --set-env-vars "${env_vars[@]}" -o none
    # Secrets are only read at container start; restart so a changed secret takes effect
    # even when the update above didn't create a new revision.
    az containerapp revision restart -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" \
      --revision "$(az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" \
        --query properties.latestRevisionName -o tsv)" -o none
  else
    az containerapp create -g "$AZURE_RESOURCE_GROUP" -n "$API_APP_NAME" \
      --environment "$CONTAINERAPPS_ENV" --image "$API_IMAGE" \
      --registry-server "$ACR_SERVER" --registry-username "$ACR_USERNAME" --registry-password "$ACR_PASSWORD" \
      --target-port 8000 --ingress external \
      --cpu "$API_CPU" --memory "$API_MEMORY" --min-replicas 1 --max-replicas 1 \
      --secrets "${secrets[@]}" --env-vars "${env_vars[@]}" -o none
  fi

  API_URL="https://$(app_fqdn "$API_APP_NAME")"
  wait_for_health "$API_URL/health"
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
}

# --- Main --------------------------------------------------------------------

SKIP_BUILD=false
COMMAND=deploy
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    destroy) COMMAND=destroy ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) die "Unknown argument: $arg (see --help)" ;;
  esac
done

if [ "$COMMAND" = destroy ]; then
  destroy
  exit 0
fi

check_prerequisites
ensure_infrastructure
[ "$SKIP_BUILD" = true ] || build_and_push
deploy_api
deploy_front

log "Done"
echo "  Frontend: $FRONT_URL"
echo "  API:      $API_URL  (docs: $API_URL/docs)"
echo "  Tag:      $TAG"
