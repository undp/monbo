#!/usr/bin/env bash
#
# Operator commands on an environment's layer share: seed it from the Git layers, and
# manage the country registry. Never run from CI: `seed` prints passkeys and needs the
# Git LFS rasters (git lfs pull).
#
# Usage:
#   tools/layers-ops/layers-ops.sh <env> seed                       # fill the share with the Git layers, per country (empties it first)
#   tools/layers-ops/layers-ops.sh <env> countries list             # the countries on the share and their layers
#   tools/layers-ops/layers-ops.sh <env> countries add|rotate CC    # prints the country's new admin passkey once
#   tools/layers-ops/layers-ops.sh <env> countries disable|enable CC
#   tools/layers-ops/layers-ops.sh <env> countries unlock           # only after an interrupted command
#
# The storage account, share and resource group come from the environment's
# Terraform platform outputs (infra/terraform/platform); the subscription from
# ARM_SUBSCRIPTION_ID (infra/envs/<env>.secrets.env). The commands themselves are
# the API's (app.modules.layers.seed, .migrate_countries, app.modules.admin.countries,
# .azure_registry), run with uv from apps/api.
#
# Requirements: az CLI (logged in), terraform >= 1.16, uv, python3; git-lfs with the
# rasters pulled for `seed`.

set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/infra/lib.sh"

# Where `seed` writes each country's old id -> new id (for the parity check).
SEED_MAPPING_OUT="${SEED_MAPPING_OUT:-/tmp/monbo-seed-ids.json}"

# `seed` converts the Git-tracked rasters; LFS pointers would fail it midway. (The API
# image doesn't contain them, so building doesn't need them.)
check_rasters_are_real() {
  local raster
  for raster in "$REPO_ROOT"/apps/api/app/maps/layers/rasters/*.tif; do
    if head -c 100 "$raster" | grep -q "git-lfs.github.com/spec"; then
      die "$(basename "$raster") is a Git LFS pointer. Run 'git lfs pull' first"
    fi
  done
  ok "Rasters are real files (not LFS pointers)"
}

# Dies when az fails, which must not be mistaken for an empty share.
share_is_empty() {
  local count
  count="$(AZURE_STORAGE_KEY="$1" az storage file list --account-name "$STORAGE_ACCOUNT_NAME" \
    --share-name "$MAPS_SHARE_NAME" --num-results 1 --query 'length(@)' -o tsv --only-show-errors)" \
    || die "Could not list the '$MAPS_SHARE_NAME' share (see the az error above)"
  [ "$count" = "0" ]
}

# Fills the share with the Git-tracked layers (apps/api/app/maps, needs `git lfs
# pull`) in the per-country layout, for a new environment or to start an environment
# over. Every raster is validated and converted to a Cloud Optimized GeoTIFF (the
# seed command), then split by country (the migration command, which prints one admin
# passkey per country). A share that already has files is emptied first, after typing
# its name: every layer and admin change on it is lost. Deploy right after, so the API
# reads the new layout.
seed_share() {
  local key tmp answer
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
  TEMP_FILES+=("$tmp")
  log "Preparing the layers (validation and COG conversion take a few minutes)"
  uv run --quiet --directory "$REPO_ROOT/apps/api" python -m app.modules.layers.seed \
    --target "$tmp/flat" || die "Seeding failed; the share is unchanged"
  uv run --quiet --directory "$REPO_ROOT/apps/api" python -m app.modules.layers.migrate_countries \
    --source "$tmp/flat" --target "$tmp/layers" --mapping-out "$SEED_MAPPING_OUT" \
    || die "The per-country migration failed; the share is unchanged"
  echo "  Put each passkey above in the password manager now: it is not stored anywhere."
  echo "  Old id -> new id per country, for tests.regression.parity --mapping: $SEED_MAPPING_OUT"

  # Only now, with the new layers ready, empty the share: after a snapshot of what it
  # holds, so this exact content can be restored (the daily backup may be hours old).
  if ! share_is_empty "$key"; then
    local snapshot
    snapshot="$(AZURE_STORAGE_KEY="$key" az storage share snapshot --name "$MAPS_SHARE_NAME" \
      --account-name "$STORAGE_ACCOUNT_NAME" --query snapshot -o tsv --only-show-errors)" \
      || die "Could not snapshot the '$MAPS_SHARE_NAME' share; it is unchanged"
    ok "Snapshot of the current content: $snapshot (restore it from the portal if needed)"
    log "Emptying the '$MAPS_SHARE_NAME' share"
    AZURE_STORAGE_KEY="$key" az storage file delete-batch --account-name "$STORAGE_ACCOUNT_NAME" \
      --source "$MAPS_SHARE_NAME" -o none
  fi
  # countries.json goes last: infra/deploy.sh only deploys on a share that has it, so an upload
  # that dies midway leaves a share it refuses instead of a half-filled one.
  local incomplete="The upload failed: the share is incomplete and has no countries.json, so infra/deploy.sh won't deploy on it. Run the seed command again"
  mv "$tmp/layers/countries.json" "$tmp/countries.json"
  log "Uploading the layers"
  AZURE_STORAGE_KEY="$key" az storage file upload-batch --account-name "$STORAGE_ACCOUNT_NAME" \
    --destination "$MAPS_SHARE_NAME" --source "$tmp/layers" -o none || die "$incomplete"
  AZURE_STORAGE_KEY="$key" az storage file upload --account-name "$STORAGE_ACCOUNT_NAME" \
    --share-name "$MAPS_SHARE_NAME" --source "$tmp/countries.json" --path countries.json \
    -o none --only-show-errors || die "$incomplete"
  ok "The share has the per-country layers. Deploy now so the API reads them: infra/deploy.sh $ENV_NAME"
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
    *) die "Usage: tools/layers-ops/layers-ops.sh <env> countries list|add|rotate|disable|enable [CC] or unlock" ;;
  esac
  [ "$command" = list ] || [ "$command" = unlock ] || [ -n "$code" ] \
    || die "'countries $command' needs a country code"
  require_cmd az
  require_cmd uv
  select_subscription

  key="$(storage_key)"
  if [ "$command" = unlock ]; then
    echo "  Only break the lease after confirming no country command is running."
    read -r -p "Type unlock to continue: " answer
    [ "$answer" = unlock ] || die "Aborted; the lease is unchanged"
    AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/apps/api" \
      python -m app.modules.admin.azure_registry break-stale-lease \
      --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME"
    ok "Country registry lease released"
    return 0
  fi
  tmp="$(mktemp -d)"
  TEMP_FILES+=("$tmp")
  etag="$(AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/apps/api" \
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

  output="$(uv run --quiet --group azure --directory "$REPO_ROOT/apps/api" python -m app.modules.admin.countries \
    "$command" ${code:+"$code"} --root "$tmp")" \
    || die "'countries $command' failed; nothing was uploaded"
  if [ "$command" = list ]; then
    printf '%s\n' "$output"
    return 0
  fi

  if [ "$command" = add ]; then
    AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/apps/api" \
      python -m app.modules.admin.azure_registry publish \
      --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME" \
      --expected-etag "$etag" --source "$tmp/countries.json" \
      --country "$code" --country-index "$tmp/$code/index.json" \
      || die "The country was not registered; run the command again"
  else
    AZURE_STORAGE_KEY="$key" uv run --quiet --group azure --directory "$REPO_ROOT/apps/api" \
      python -m app.modules.admin.azure_registry publish \
      --account "$STORAGE_ACCOUNT_NAME" --share "$MAPS_SHARE_NAME" \
      --expected-etag "$etag" --source "$tmp/countries.json" \
      || die "The registry was not updated; run the command again"
  fi
  printf '%s\n' "$output"
  ok "Updated countries.json on the share; the API applies it on its next request"
}

# --- Main --------------------------------------------------------------------

[ "$#" -ge 2 ] || { sed -n '2,20p' "$0"; exit 1; }
ENV_NAME="$1"
COMMAND="$2"
shift 2
case "$COMMAND" in
  seed|countries) ;;
  *) die "Unknown command: $COMMAND (seed or countries)" ;;
esac
require_env "$ENV_NAME"
load_env_secrets "$ENV_NAME"
require_cmd "$TERRAFORM"
load_platform_outputs "$ENV_NAME"

if [ "$COMMAND" = seed ]; then
  [ "$#" -eq 0 ] || die "'seed' takes no arguments"
  seed_share
else
  # (the +-expansion keeps bash 3.2's `set -u` happy with no arguments)
  countries ${@+"$@"}
fi
