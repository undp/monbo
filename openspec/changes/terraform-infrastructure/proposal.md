## Why

Monbo's Azure environment is built by `azure/deploy.sh`, 33 KB of idempotent bash, plus `azure/render_api_app.py`. It works, but it lacks the three properties infrastructure as code exists for:

- **No declared state.** Nothing in the repository says "this is what the environment looks like". A change made in the portal is neither detected nor reverted.
- **No plan.** There is no way to see what a run will change before it runs, which matters for a script that manages a delete lock, backups and the only durable copy of the layers.
- **No reproducible environments.** A second environment (production) would mean copying and editing `deploy.env` by hand.

The technical review has flagged this three times, and the cost of migrating grows with the script.

The team decided on Terraform. It covers the whole environment, is parametrized per environment, and the current Azure environment can be destroyed and rebuilt from scratch, with the Git layers as its only data. Change 1 (the image has no layers) and change 2 (`apps/`) are in place, so the infrastructure now has a single deployment mode and a stable layout to describe. Change 5, deployment from CI, builds on this one.

## What Changes

- **`infra/terraform/` declares the whole environment with azurerm 5.x**, in two stacks per environment:
  - **`platform`** holds what outlives releases:
    - the data resource group with its `CanNotDelete` lock;
    - the storage account (TLS 1.2, no public blob access) and the `maps` share, with 14-day soft delete;
    - the Recovery Services vault, with daily backups kept 30 days;
    - the container registry, with its admin user **off**;
    - the Log Analytics workspace.
    Everything holding data has `prevent_destroy`.
  - **`apps`** holds what can be destroyed:
    - the apps resource group and the Container Apps environment (logging to Log Analytics);
    - the share registered on the environment;
    - a user-assigned identity with `AcrPull`, which replaces the registry's admin password;
    - the API and web Container Apps, with the same settings `render_api_app.py` and `deploy_front` produce today.
- **Per-environment configuration:**
  - `envs/<env>.tfvars` and `envs/<env>.backend.hcl` per stack;
  - only `dev` exists this cycle, deployed from the `dev` branch;
  - names are `monbo-<env>-…`, except the storage account and the registry: Azure only allows lowercase letters and digits in those global names, so they are `monbo<env>data` and `monbo<env>acr`. An optional suffix is there only if one is ever taken;
  - production is a new pair of files, not a redesign.
- **Remote state** in a dedicated storage account (Entra ID auth, blob versioning and soft delete). It is created once by `infra/bootstrap.sh`, so no local state file ever holds its key.
- **Secrets, and the subscription, never live in the repository.**
  - The subscription comes from `ARM_SUBSCRIPTION_ID`, the variable the azurerm provider reads.
  - The Google Maps keys and `ADMIN_SESSION_SECRET` arrive as sensitive `TF_VAR_*` variables:
    - from a git-ignored env file for an operator;
    - from GitHub Environment secrets in change 5.
  - They are stored as Container App secrets.
  - Country passkeys stay on the share.
- **One deploy script, `infra/deploy.sh <env>`:**
  1. builds and pushes both images, tagged with the commit;
  2. refuses an unseeded share;
  3. runs `terraform apply` on `apps` with those tags;
  4. verifies `/health` reports `mapsRoot=/mnt/maps` as writable.
  The same script is what change 5 runs from CI.
- **Data-plane operations move to `tools/layers-ops/`.** `seed` and `countries add|list|rotate|disable|enable|unlock` keep their behaviour and safeguards, and now read the resource names from the Terraform outputs.
- **BREAKING (operators): `azure/` is deleted.** That is `deploy.sh`, `render_api_app.py`, `deploy.env.example`, and the stale `monbo-frontend-app.yml`, which was unused and pointed at a personal Docker Hub image. `deploy.sh destroy` becomes `terraform destroy` on the `apps` stack.
- **The current environment is rebuilt, not imported.** `dev` is created under new names (`monbo-dev-*`) next to the old resources (`monbo-test`, `monbo-data`, `monboacr`, `monbodata`). It is seeded from Git and verified. Then the old resource groups are removed, which first needs the lock and the backup protection removed.
- **CI checks Terraform.** `ci.yml` gains a `Terraform` job (`fmt -check`, `validate`) selected by changes under `infra/`. Dependabot gains `terraform` entries.

## Capabilities

### New Capabilities

- `infrastructure-as-code`:
  - Terraform layout, stacks and environments;
  - remote state;
  - variables and secrets;
  - identity-based registry pulls;
  - the deploy script and its checks;
  - Terraform in CI and Dependabot;
  - rebuilding an environment from scratch.

### Modified Capabilities

- `layer-storage-infrastructure`:
  - storage and the apps are declared in Terraform instead of being provisioned by `azure/deploy.sh`;
  - destroying the apps stack keeps the data;
  - `seed` and the country commands move to `tools/layers-ops`;
  - deploying requires a seeded share, checked by `infra/deploy.sh`.
- `automated-dependency-updates`: Dependabot also covers the Terraform providers.
- `continuous-integration`: change detection selects a Terraform job for `infra/` changes.

## Impact

- **New:**
  - `infra/bootstrap.sh`;
  - `infra/deploy.sh`;
  - `infra/terraform/platform/` and `infra/terraform/apps/`, each with `envs/dev.tfvars`, `envs/dev.backend.hcl`, `.terraform.lock.hcl` and `tests/`, plus `infra/envs/dev.secrets.env.example`;
  - `tools/layers-ops/`.
- **Deleted:** `azure/`.
- **CI and config:**
  - `.github/workflows/ci.yml` (`infra` output and `Terraform` job);
  - `.github/dependabot.yml`;
  - `.gitignore` (Terraform working files, env secret files).
- **Docs:**
  - `docs/suggested_deployment.md`, rewritten around Terraform;
  - `docs/architecture.md` (resources, identity, logs);
  - `docs/onboarding.md`, the READMEs and `CHANGELOG.md`.
- **Agent skills:** `.claude/skills/pr-review` and `pr-comment-triage`. The `NEXT_PUBLIC_*` checklist points at the web app's env in `infra/terraform/apps` instead of `azure/monbo-frontend-app.yml`.
- **Azure (subscription `Monbo-DEV`):**
  - new resource groups for `dev`, plus `monbo-tfstate` for the state;
  - the old `monbo-test` and `monbo-data` groups are removed after cut-over;
  - the development URLs change, because the Container Apps environment is new.
- **Tooling:** operators need Terraform ≥ 1.16 (or the `hashicorp/terraform` image), the az CLI, Docker and uv.
- **Permissions** (assumed available, per the roadmap): Owner or User Access Administrator on the subscription, to assign `AcrPull` and the state account's data role.
