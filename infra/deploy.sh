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
# Rollback: before applying, it notes the image of each app's last healthy revision.
# If the apply fails, or either app's new revision doesn't become ready with the new
# image, or the API doesn't read a writable /mnt/maps, it applies those images again
# (both apps, so they never run mismatched versions) and exits with an error. Container
# Apps keeps the previous revision serving until a new one is ready, so users don't see
# a failed revision; the rollback brings Terraform's state back in line with it.
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

APPS_RG="monbo-$ENV_NAME-apps"

# In GitHub Actions, the outcome goes to the run's summary page.
summary() {
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] || return 0
  {
    echo "### Deploy to \`$ENV_NAME\`: $1"
    echo
    echo "| | |"
    echo "|---|---|"
    echo "| Tag | \`$TAG\` |"
    [ -z "${WEB_URL:-}" ] || echo "| Frontend | $WEB_URL |"
    [ -z "${API_URL:-}" ] || echo "| API | $API_URL |"
    [ -z "${2:-}" ] || echo "| Details | $2 |"
  } >> "$GITHUB_STEP_SUMMARY"
}
API_APP=monbo-api
WEB_APP=monbo-front

# The image of an app's latest ready revision: what is serving now. Empty when the
# app doesn't exist yet (first deploy) or has never had a ready revision.
serving_image() {
  local ready
  ready="$(az containerapp show --only-show-errors -g "$APPS_RG" -n "$1" \
    --query properties.latestReadyRevisionName -o tsv 2>/dev/null || true)"
  [ -n "$ready" ] || return 0
  az containerapp revision show --only-show-errors -g "$APPS_RG" -n "$1" --revision "$ready" \
    --query 'properties.template.containers[0].image' -o tsv 2>/dev/null || true
}

# Waits until the app's latest revision is the ready one and runs IMAGE. Fails fast
# when that revision fails; gives up after ~10 minutes (the startup probe allows ~2).
wait_for_revision() {
  local app="$1" image="$2" latest="" ready state running running_image
  for _ in $(seq 1 60); do
    read -r latest ready < <(az containerapp show --only-show-errors -g "$APPS_RG" -n "$app" \
      --query "[properties.latestRevisionName, properties.latestReadyRevisionName]" -o tsv | paste -s -)
    if [ -n "$latest" ]; then
      read -r state running running_image < <(az containerapp revision show --only-show-errors -g "$APPS_RG" -n "$app" \
        --revision "$latest" \
        --query "[properties.provisioningState, properties.runningState, properties.template.containers[0].image]" \
        -o tsv | paste -s -)
      if [ "$latest" = "$ready" ] && [ "$running_image" = "$image" ]; then
        ok "$app: revision $latest is ready with $image"
        return 0
      fi
      case "$state/$running" in
        Failed/*|*/Failed|*/Degraded)
          echo "  $app: revision $latest is $state/$running" >&2
          FAILED_REVISION="$app/$latest"
          return 1 ;;
      esac
    fi
    sleep 10
  done
  echo "  $app: revision $latest did not become ready" >&2
  FAILED_REVISION="$app/$latest"
  return 1
}

# The API must read (and, for the admin, write) the share; the web app must answer.
check_endpoints() {
  local health report=""
  for _ in $(seq 1 12); do
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
  [ -z "$report" ] || { echo "  $report" >&2; return 1; }
  for _ in $(seq 1 12); do
    curl -fsS "$WEB_URL/api/health" >/dev/null 2>&1 && { ok "Frontend is healthy"; return 0; }
    sleep 10
  done
  echo "  $WEB_URL/api/health did not answer" >&2
  return 1
}

verify_deployment() {
  wait_for_revision "$API_APP" "$1" && wait_for_revision "$WEB_APP" "$2" && check_endpoints
}

log "Applying the apps stack"
tf_init apps "$ENV_NAME"
tf_args=(-var-file="envs/$ENV_NAME.tfvars")
if [ "$PLAN_ONLY" = true ]; then
  "$TERRAFORM" -chdir="$TF_ROOT/apps" plan -input=false "${tf_args[@]}" \
    -var "api_image=$API_IMAGE" -var "web_image=$WEB_IMAGE"
  exit 0
fi

# What to roll back to: the images serving now.
PREVIOUS_API_IMAGE="$(serving_image "$API_APP")"
PREVIOUS_WEB_IMAGE="$(serving_image "$WEB_APP")"
if [ -n "$PREVIOUS_API_IMAGE" ] && [ -n "$PREVIOUS_WEB_IMAGE" ]; then
  ok "Rollback target: $PREVIOUS_API_IMAGE and $PREVIOUS_WEB_IMAGE"
else
  echo "  No healthy revision yet (first deploy): a failure can't be rolled back"
fi

# Without --yes, terraform shows the plan and asks before applying.
approve_args=()
[ "$AUTO_APPROVE" = true ] && approve_args=(-input=false -auto-approve)

apply_images() {
  "$TERRAFORM" -chdir="$TF_ROOT/apps" apply "${tf_args[@]}" ${approve_args[@]+"${approve_args[@]}"} \
    -var "api_image=$1" -var "web_image=$2"
}

rollback() {
  local reason="$1" failed="${FAILED_REVISION:-}"
  if [ -z "$PREVIOUS_API_IMAGE" ] || [ -z "$PREVIOUS_WEB_IMAGE" ]; then
    die "$reason. Nothing to roll back to (first deploy): fix and deploy again"
  fi
  log "Rolling back to $PREVIOUS_API_IMAGE and $PREVIOUS_WEB_IMAGE"
  # The operator already approved this deploy; the rollback doesn't ask again.
  approve_args=(-input=false -auto-approve)
  if apply_images "$PREVIOUS_API_IMAGE" "$PREVIOUS_WEB_IMAGE" \
    && verify_deployment "$PREVIOUS_API_IMAGE" "$PREVIOUS_WEB_IMAGE"; then
    ok "Rolled back: the previous images are serving again"
  else
    echo "  The rollback did not verify either; check the apps in the portal" >&2
  fi
  local logs=""
  [ -z "$failed" ] || logs="az containerapp logs show -g $APPS_RG -n ${failed%%/*} --revision ${failed#*/} --tail 100"
  [ -z "$logs" ] || echo "  Logs of the failed revision: $logs" >&2
  summary "❌ rolled back to the previous images" "$reason. Previous: \`$PREVIOUS_API_IMAGE\`, \`$PREVIOUS_WEB_IMAGE\`.${logs:+ Logs: \`$logs\`}"
  die "$reason (rolled back)"
}

apply_log="$(mktemp)"
TEMP_FILES+=("$apply_log")
if ! apply_images "$API_IMAGE" "$WEB_IMAGE" 2>&1 | tee "$apply_log"; then
  if grep -q "Apply cancelled" "$apply_log"; then
    die "Apply cancelled; nothing changed"
  fi
  # A new pull identity's AcrPull takes a minute or two to propagate; the first apply
  # of a fresh environment can fail pulling. Retry that case once.
  if grep -qiE "unauthorized|denied|AcrPull|failed to pull" "$apply_log"; then
    echo "  The registry refused the pull (AcrPull may still be propagating); retrying in 90 s"
    sleep 90
    approve_args=(-input=false -auto-approve)
    apply_images "$API_IMAGE" "$WEB_IMAGE" || rollback "terraform apply failed"
  else
    rollback "terraform apply failed"
  fi
fi

API_URL="$("$TERRAFORM" -chdir="$TF_ROOT/apps" output -raw api_url)"
WEB_URL="$("$TERRAFORM" -chdir="$TF_ROOT/apps" output -raw web_url)"

log "Verifying the deployment"
verify_deployment "$API_IMAGE" "$WEB_IMAGE" || rollback "The new revisions did not become healthy"

summary "✅ deployed"
# The GitHub Environment's link to the deployed app.
[ -z "${GITHUB_OUTPUT:-}" ] || echo "web_url=$WEB_URL" >> "$GITHUB_OUTPUT"
log "Done ($ENV_NAME)"
echo "  Frontend: $WEB_URL"
echo "  API:      $API_URL  (docs: $API_URL/docs)"
echo "  Tag:      $TAG"
