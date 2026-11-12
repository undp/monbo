#!/usr/bin/env bash
# Copies the git-ignored env files from the main checkout into the current worktree.
#
# Usage (from anywhere inside the worktree):
#   scripts/setup-worktree.sh            # copy the files that are missing
#   scripts/setup-worktree.sh --force    # also overwrite the ones that exist
#
# The source is the main worktree (the first one `git worktree list` reports).
# Override it with MONBO_ENV_SOURCE=/path/to/checkout; Conductor's
# CONDUCTOR_ROOT_PATH is used when set.
set -euo pipefail

ENV_FILES=(
  "apps/api/.env"
  "apps/web/.env.development"
  "infra/envs/dev.secrets.env"
)

force=false
case "${1:-}" in
  "") ;;
  -f | --force) force=true ;;
  -h | --help)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Unknown option: $1 (use --force or --help)" >&2
    exit 2
    ;;
esac

target="$(git rev-parse --show-toplevel)"
source_root="${MONBO_ENV_SOURCE:-${CONDUCTOR_ROOT_PATH:-}}"
if [[ -z "$source_root" ]]; then
  source_root="$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')"
fi

if [[ ! -d "$source_root" ]]; then
  echo "Source checkout not found: $source_root" >&2
  exit 1
fi
if [[ "$(cd "$source_root" && pwd -P)" == "$(cd "$target" && pwd -P)" ]]; then
  echo "This is the main checkout ($target); nothing to copy."
  exit 0
fi

echo "Copying env files from $source_root to $target"
missing=0
for rel in "${ENV_FILES[@]}"; do
  src="$source_root/$rel"
  dst="$target/$rel"
  if [[ ! -f "$src" ]]; then
    echo "  missing  $rel (not in the source checkout)"
    missing=$((missing + 1))
    continue
  fi
  if [[ -e "$dst" && "$force" != true ]]; then
    echo "  kept     $rel (already exists; --force overwrites it)"
    continue
  fi
  mkdir -p "$(dirname "$dst")"
  # -p keeps the mode, so dev.secrets.env stays 0600.
  cp -p "$src" "$dst"
  echo "  copied   $rel"
done

if ((missing > 0)); then
  echo "$missing file(s) missing in the source; create them from the templates (docs/onboarding.md §4)." >&2
  exit 1
fi
