# Helpers shared by infra/deploy.sh and tools/layers-ops/layers-ops.sh. Source it;
# don't run it. Callers set `set -euo pipefail` first.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_ROOT="$REPO_ROOT/infra/terraform"
TERRAFORM="${TERRAFORM:-terraform}"

# Silence harmless SyntaxWarnings the Homebrew az CLI (Python 3.14) prints from its own SDK.
export PYTHONWARNINGS="ignore::SyntaxWarning"

# Temporary files and folders, some holding secrets: removed however the script exits
# (a `die`, a failed command under `set -e`, Ctrl-C). Add each one right after
# creating it.
TEMP_FILES=()
remove_temp_files() {
  [ "${#TEMP_FILES[@]}" -eq 0 ] || rm -rf "${TEMP_FILES[@]}"
}
trap remove_temp_files EXIT

log() { printf '\n\033[1;34m► %s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed"
}

# The environment's files must exist in both stacks before anything runs.
require_env() {
  local env="$1" stack
  [ -n "$env" ] || die "Missing the environment name (e.g. test)"
  for stack in platform apps; do
    [ -f "$TF_ROOT/$stack/envs/$env.tfvars" ] || die "No $stack/envs/$env.tfvars: unknown environment '$env'"
    [ -f "$TF_ROOT/$stack/envs/$env.backend.hcl" ] || die "No $stack/envs/$env.backend.hcl"
  done
  if grep -q CHANGEME "$TF_ROOT"/*/envs/"$env".*; then
    die "Fill in the CHANGEME values of infra/terraform/*/envs/$env.* first (infra/bootstrap.sh prints them)"
  fi
}

# The environment's secrets and its subscription (ARM_SUBSCRIPTION_ID, which the
# azurerm provider and the az calls below use): exported in the shell (CI) or read
# from infra/envs/<env>.secrets.env (git-ignored).
load_env_secrets() {
  local file="$REPO_ROOT/infra/envs/$1.secrets.env"
  if [ -f "$file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
  [ -n "${ARM_SUBSCRIPTION_ID:-}" ] \
    || die "ARM_SUBSCRIPTION_ID is not set (see infra/envs/$1.secrets.env.example)"
  export ARM_SUBSCRIPTION_ID
  AZURE_SUBSCRIPTION_ID="$ARM_SUBSCRIPTION_ID"
}

tf_init() {
  local stack="$1" env="$2"
  "$TERRAFORM" -chdir="$TF_ROOT/$stack" init -input=false -reconfigure \
    -backend-config="envs/$env.backend.hcl" >/dev/null \
    || die "terraform init failed for $stack ($env). Logged in with 'az login'? Access to the state account?"
}

# Reads the platform stack's outputs once; `platform_output NAME` prints one.
PLATFORM_OUTPUTS=""
load_platform_outputs() {
  local env="$1"
  tf_init platform "$env"
  PLATFORM_OUTPUTS="$("$TERRAFORM" -chdir="$TF_ROOT/platform" output -json)" \
    || die "Could not read the platform outputs"
  [ "$PLATFORM_OUTPUTS" != "{}" ] \
    || die "The platform stack of '$env' has not been applied yet (docs/suggested_deployment.md)"
  STORAGE_ACCOUNT_NAME="$(platform_output storage_account_name)"
  MAPS_SHARE_NAME="$(platform_output maps_share_name)"
  DATA_RESOURCE_GROUP="$(platform_output data_resource_group_name)"
}

platform_output() {
  printf '%s' "$PLATFORM_OUTPUTS" | python3 -c 'import json, sys; print(json.load(sys.stdin)[sys.argv[1]]["value"])' "$1"
}

# Pin every az call to the environment's subscription so we never touch whatever
# subscription happens to be the CLI default.
select_subscription() {
  az account show >/dev/null 2>&1 || die "Not logged in to Azure. Run 'az login' first"
  az account set --subscription "$AZURE_SUBSCRIPTION_ID" \
    || die "Cannot access subscription $AZURE_SUBSCRIPTION_ID with the current login"
  # The name helps an operator confirm where they are; CI logs of a public repository
  # shouldn't show it (the id itself is a masked secret there).
  if [ -n "${CI:-}" ]; then
    ok "Subscription selected (ARM_SUBSCRIPTION_ID)"
  else
    ok "Subscription: $(az account show --query name -o tsv)"
  fi
}

storage_key() {
  az storage account keys list -g "$DATA_RESOURCE_GROUP" -n "$STORAGE_ACCOUNT_NAME" \
    --query '[0].value' -o tsv
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
