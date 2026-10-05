#!/usr/bin/env bash
#
# Deploy the API and the frontend of an environment: build and push both images,
# apply the Terraform apps stack with them, and verify the result. The same script
# runs locally and from CI.
#
# Usage:
#   ./infra/deploy.sh dev                 # build, push, apply (asks to confirm the plan)
#   ./infra/deploy.sh <env> --yes         # apply without asking (CI)
#   ./infra/deploy.sh <env> --plan-only   # build and push, then only show the plan
#   ./infra/deploy.sh <env> --skip-build  # reuse images already in the registry (TAG)
#
# It never applies the platform stack (layers, backups, registry): that is a separate,
# deliberate `terraform apply` (docs/suggested_deployment.md).
#
# Secrets and the subscription (TF_VAR_*, ARM_SUBSCRIPTION_ID) are exported in the
# shell (CI) or read from infra/envs/<env>.secrets.env (git-ignored; copy the
# .example next to it).
# TAG defaults to the current commit's short SHA.
#
# Requirements: az CLI (logged in), terraform >= 1.16, Docker running, curl, python3.

set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

ENV_NAME=""
SKIP_BUILD=false
PLAN_ONLY=false
AUTO_APPROVE=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --plan-only) PLAN_ONLY=true ;;
    --yes) AUTO_APPROVE=true ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    -*) die "Unknown option: $arg (see --help)" ;;
    *) [ -z "$ENV_NAME" ] || die "Only one environment, got '$ENV_NAME' and '$arg'"; ENV_NAME="$arg" ;;
  esac
done
require_env "$ENV_NAME"
TAG="${TAG:-$(git -C "$REPO_ROOT" rev-parse --short HEAD)}"

load_env_secrets "$ENV_NAME"

log "Checking prerequisites ($ENV_NAME, tag $TAG)"
require_cmd az
require_cmd "$TERRAFORM"
require_cmd curl
require_cmd python3
[ "$SKIP_BUILD" = true ] || require_cmd docker
[ "$SKIP_BUILD" = true ] || docker info >/dev/null 2>&1 || die "Docker is not running"
# Checked here so a missing secret fails before building, not halfway through the plan.
[ -n "${TF_VAR_gcp_maps_platform_api_key:-}" ] || die "TF_VAR_gcp_maps_platform_api_key is not set (see infra/envs/$ENV_NAME.secrets.env.example)"
[ -n "${TF_VAR_gcp_maps_platform_signature_secret:-}" ] || die "TF_VAR_gcp_maps_platform_signature_secret is not set"

load_platform_outputs "$ENV_NAME"
select_subscription
REGISTRY_NAME="$(platform_output registry_name)"
REGISTRY_SERVER="$(platform_output registry_login_server)"
API_IMAGE="$REGISTRY_SERVER/monbo-api:$TAG"
WEB_IMAGE="$REGISTRY_SERVER/monbo-front:$TAG"

# Mounting an empty share would leave the API without layers (it refuses to start).
log "Checking the layer share"
share_has_layers \
  || die "The '$MAPS_SHARE_NAME' share has no countries.json: seed it first with tools/layers-ops/layers-ops.sh $ENV_NAME seed"
ok "The share has its layers"

if [ "$SKIP_BUILD" = true ]; then
  log "Reusing images tagged $TAG"
  for repo in monbo-api monbo-front; do
    az acr repository show -n "$REGISTRY_NAME" --image "$repo:$TAG" -o none 2>/dev/null \
      || die "$repo:$TAG is not in $REGISTRY_NAME"
  done
else
  log "Building and pushing images (tag $TAG)"
  az acr login -n "$REGISTRY_NAME"
  docker build --platform linux/amd64 -f "$REPO_ROOT/apps/api/Dockerfile.prod" \
    -t "$API_IMAGE" "$REPO_ROOT/apps/api"
  docker push "$API_IMAGE"
  docker build --platform linux/amd64 -f "$REPO_ROOT/apps/web/Dockerfile.prod" \
    -t "$WEB_IMAGE" "$REPO_ROOT/apps/web"
  docker push "$WEB_IMAGE"
  ok "Pushed $API_IMAGE and $WEB_IMAGE"
fi

log "Applying the apps stack"
tf_init apps "$ENV_NAME"
tf_args=(-var-file="envs/$ENV_NAME.tfvars" -var "api_image=$API_IMAGE" -var "web_image=$WEB_IMAGE")
if [ "$PLAN_ONLY" = true ]; then
  "$TERRAFORM" -chdir="$TF_ROOT/apps" plan -input=false "${tf_args[@]}"
  exit 0
fi
# Without --yes, terraform shows the plan and asks before applying.
if [ "$AUTO_APPROVE" = true ]; then
  tf_args+=(-input=false -auto-approve)
fi

apply_log="$(mktemp)"
TEMP_FILES+=("$apply_log")
if ! "$TERRAFORM" -chdir="$TF_ROOT/apps" apply "${tf_args[@]}" 2>&1 | tee "$apply_log"; then
  # A new pull identity's AcrPull takes a minute or two to propagate; the first apply
  # of a fresh environment can fail pulling. Retry that case once.
  if grep -qiE "unauthorized|denied|AcrPull|failed to pull" "$apply_log"; then
    echo "  The registry refused the pull (AcrPull may still be propagating); retrying in 90 s"
    sleep 90
    "$TERRAFORM" -chdir="$TF_ROOT/apps" apply "${tf_args[@]}"
  else
    die "terraform apply failed"
  fi
fi

API_URL="$("$TERRAFORM" -chdir="$TF_ROOT/apps" output -raw api_url)"
WEB_URL="$("$TERRAFORM" -chdir="$TF_ROOT/apps" output -raw web_url)"

# The API must read (and, for the admin, write) the share. Retries for a while: the
# previous revision can still answer while it drains.
log "Verifying the deployment"
report=""
for _ in $(seq 1 30); do
  health="$(curl -fsS "$API_URL/health" 2>/dev/null || true)"
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
    break
  fi
  sleep 10
done
[ -z "$report" ] || { echo "  $report" >&2; die "The API does not read a writable /mnt/maps (check its logs and the mount)"; }

for _ in $(seq 1 30); do
  curl -fsS "$WEB_URL/api/health" >/dev/null 2>&1 && break
  sleep 10
done
curl -fsS "$WEB_URL/api/health" >/dev/null 2>&1 || die "$WEB_URL/api/health did not answer"
ok "Frontend is healthy"

log "Done ($ENV_NAME)"
echo "  Frontend: $WEB_URL"
echo "  API:      $API_URL  (docs: $API_URL/docs)"
echo "  Tag:      $TAG"
