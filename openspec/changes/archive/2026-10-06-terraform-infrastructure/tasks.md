## 1. Reference and scaffolding

- [x] 1.1 Capture the current environment as the reference for parity, read-only:
  - `az containerapp show` for `monbo-api` and `monbo-front`;
  - `az containerapp env show`;
  - `az storage account show` and `share-rm show`;
  - the backup policy;
  - the lock.
  Save them redacted (no secret values) under `.context/terraform/`
- [x] 1.2 Create `infra/terraform/{platform,apps}/` with `versions.tf`:
  - `required_version >= 1.16`;
  - azurerm pinned to `~> 5.8`;
  - `backend "azurerm" {}` with `use_azuread_auth`.
  Add `envs/dev.backend.hcl` (state account `monbotfstate`, container `tfstate`, key `dev/<stack>.tfstate`). Extend `.gitignore` with `.terraform/`, `*.tfstate*`, `*.tfplan`, `infra/envs/*.secrets.env`; keep `.terraform.lock.hcl` tracked
- [x] 1.3 `infra/bootstrap.sh` (az CLI, idempotent), D3:
  - resource group `monbo-tfstate`;
  - a storage account with shared keys off, TLS 1.2, no public access, blob versioning and 30-day soft delete;
  - a `tfstate` container;
  - `Storage Blob Data Contributor` for the signed-in user.
  It prints the backend values to put in `envs/*.backend.hcl`

## 2. Platform stack

- [x] 2.1 `variables.tf`: `env`, `location`, an optional `unique_suffix`, share quota. `envs/dev.tfvars` holds `env = "dev"` and `location = "eastus2"`. The subscription comes from `ARM_SUBSCRIPTION_ID`, not from a variable
- [x] 2.2 `main.tf`, data group (D2/D4):
  - `monbo-<env>-data` with a `CanNotDelete` lock;
  - the storage account: TLS1_2, no nested public items, HTTPS only, `share_properties.retention_policy.days = 14`;
  - the `maps` share: SMB, quota 10;
  - a Recovery Services vault;
  - `azurerm_backup_policy_file_share`: daily 06:00 UTC, retention 30, UTC;
  - `azurerm_backup_container_storage_account` and `azurerm_backup_protected_file_share`.
  `prevent_destroy` on the account, share, vault and protected share
- [x] 2.3 `main.tf`, platform group:
  - `monbo-<env>-platform`;
  - the container registry: Basic, `admin_enabled = false`;
  - the Log Analytics workspace: PerGB2018, 30 days
- [x] 2.4 `outputs.tf`:
  - resource group names;
  - storage account id and name, share name;
  - registry id and login server;
  - Log Analytics id;
  - vault name.
  Set the provider's `resource_providers_to_register` to cover Microsoft.App, ContainerRegistry, OperationalInsights, Storage and RecoveryServices

## 3. Apps stack

- [x] 3.1 `data.tf`: `terraform_remote_state` of `platform` for the same environment, plus the storage account data source for its access key, which the environment storage needs
- [x] 3.2 `variables.tf`:
  - sizes, validated as a Container Apps pair;
  - `api_image` and `web_image` (required);
  - thresholds, testing warning, satellite cap, contact URL;
  - `admin_allowed_origin` override;
  - sensitive `gcp_maps_platform_api_key`, `gcp_maps_platform_signature_secret`, `front_gcp_maps_platform_api_key` (optional) and `admin_session_secret` (optional, at least 32 characters, validated).
  `envs/dev.tfvars` holds today's `deploy.env` values
- [x] 3.3 `main.tf`, environment (D5):
  - `monbo-<env>-apps`;
  - the Container Apps environment with `log_analytics_workspace_id`;
  - `azurerm_container_app_environment_storage` `maps` (ReadWrite);
  - a user-assigned identity, with an `AcrPull` role assignment on the registry
- [x] 3.4 `api.tf` (D6), mirroring `render_api_app.py`:
  - Single revision mode, 1/1 replicas, 1 CPU / 2 GiB defaults;
  - external ingress on 8000, no insecure;
  - startup probe on `/health` (delay 5, interval 5, threshold 24);
  - readiness probe on `/health` (interval 15, timeout 3, threshold 3);
  - liveness probe on `/health/live` (interval 30, timeout 5, threshold 3);
  - the `maps` volume with `mount_options = "uid=10001,gid=10001,dir_mode=0750,file_mode=0640"`, mounted at `/mnt/maps`, and `MAPS_ROOT`;
  - secrets with secret-ref env vars;
  - `OVERLAP_THRESHOLD_PERCENTAGE`;
  - a dynamic admin secret and env, with `ADMIN_ALLOWED_ORIGIN` defaulting to `https://<web>.<default_domain>`;
  - registry by identity, `depends_on` the role assignment
- [x] 3.5 `web.tf`:
  - external ingress on 3000, 0.5 CPU / 1 GiB, 1/1 replicas;
  - the seven `NEXT_PUBLIC_*` env vars from `deploy_front`, with `NEXT_PUBLIC_API_URL = https://<api>.<default_domain>`;
  - the Maps browser key as a secret ref;
  - a startup probe on `/api/health`;
  - registry by identity
- [x] 3.6 `outputs.tf`: the API and web URLs, the environment's default domain, the app names

## 4. Scripts

- [x] 4.1 `infra/deploy.sh <env> [--skip-build] [--plan-only]` (D8):
  - load `infra/envs/<env>.secrets.env` when present;
  - check the tools and select the subscription;
  - `terraform init` both stacks with their backend files and read the `platform` outputs;
  - refuse an unseeded share (ported `share_file_exists countries.json`, with its "az failed ≠ empty" distinction);
  - `docker build --platform linux/amd64` and push both images (tag `git rev-parse --short HEAD`, or `TAG`);
  - `terraform apply` on `apps` with `-var api_image/web_image`, retrying once on an `AcrPull` propagation error;
  - port `verify_maps_root` and `wait_for_health`;
  - print the URLs and the tag
- [x] 4.2 `tools/layers-ops/layers-ops.sh <env> seed|countries …` (D9): port `seed_share`, `share_is_empty`, `share_file_exists`, `check_rasters_are_real`, `storage_key` and `countries` from `azure/deploy.sh` unchanged, reading the account, share and resource group from the `platform` outputs. Add `tools/layers-ops/README.md`
- [x] 4.3 `infra/envs/dev.secrets.env.example`, with the variable names (`ARM_SUBSCRIPTION_ID` included) and no values
- [x] 4.4 Delete `azure/`: `deploy.sh`, `render_api_app.py`, `deploy.env.example` and `monbo-frontend-app.yml`

## 5. CI and Dependabot

- [x] 5.1 `ci.yml`:
  - `Detect changes` outputs `infra` (`infra/**`, and `ci.yml` → all);
  - a new `terraform` job, `name: Terraform`, with the same draft and fail-open `if:`;
  - `hashicorp/setup-terraform`, SHA-pinned, with `terraform_version` 1.16.5;
  - `fmt -check -recursive infra/terraform`, then `init -backend=false` and `validate` for each stack;
  - `contents: read`
- [x] 5.2 `dependabot.yml`: `terraform` entries for `/infra/terraform/platform` and `/infra/terraform/apps` (weekly, grouped minor/patch, label `infrastructure`). Create the `infrastructure` label
  - Done in `dependabot.yml`, as one entry with `directories:` so both stacks bump azurerm together. The `infrastructure` label was created on GitHub (color 0e8a16).
- [x] 5.3 Commit `.terraform.lock.hcl` for both stacks with `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64`

## 6. Local validation (no Azure changes)

- [x] 6.1 Using `hashicorp/terraform:1.16.5` in Docker:
  - `fmt -check`;
  - `init -backend=false` and `validate` for both stacks;
  - a plan of `platform` against the real subscription with `-lock=false` and a local backend override, read-only, after confirming with the user.
  Check that the plan shows exactly the resources of D2/D4
  - Done: `fmt`, `validate`, and `terraform test` with mocked providers. `platform` passes 3 tests (names; TLS, soft delete, backup 06:00/30 d, lock, registry admin off; suffix validation). `apps` passes 5 (probes, mount, `MAPS_ROOT`, replicas, ingress, pull by identity, admin on/off, origin default, web env vars; size and secret validation). A mutation check showed the tests fail when a value is broken. The same steps run in the `Terraform` CI job.
  - **Read-only plan against the real subscription (2026-10-05):** run on a temporary copy with a local backend and provider registration off, so nothing in Azure changed. Result: `Plan: 11 to add, 0 to change, 0 to destroy`, with exactly the D2/D4 resources: `monbo-dev-data`, `monbo-dev-platform`, `monbodevdata` (TLS1_2, HTTPS only, no public, share retention 14), share `maps` (10 GiB, SMB), `monbo-dev-backup`, policy `maps-daily-30d` (daily 06:00 UTC, 30), backup container and protected share, `monbodevacr` (Basic, admin off), `monbo-dev-logs` (30 d), and the `CanNotDelete` lock. `Microsoft.ManagedIdentity` is not registered yet; the first real apply registers it. Since the env was renamed to `dev` with an optional suffix, `platform` has 4 tests (one checks that the suffix only changes the global names).
- [x] 6.2 `bash -n` and shellcheck (Docker) on `infra/*.sh` and `tools/layers-ops/*.sh`. Run `deploy.sh` and `layers-ops.sh` with missing arguments and secrets, and confirm they fail with clear messages before touching Azure

## 7. Docs and skills

- [x] 7.1 Rewrite `docs/suggested_deployment.md`:
  - prerequisites;
  - bootstrap;
  - platform plan and apply;
  - seed;
  - deploy;
  - countries;
  - rollback (redeploy an older tag; snapshots);
  - "Removing the pre-Terraform environment" (D10 step 6);
  - adding an environment;
  - making `Terraform` a required check
- [x] 7.2 `docs/architecture.md`:
  - the resource tables for the three resource groups;
  - the identity-based registry pull;
  - Log Analytics;
  - the stacks diagram
- [x] 7.3 `docs/onboarding.md`, root `README.md`, `apps/api/README.md`, `apps/web/README.md`, `docs/maps.md`, `docs/branch_protection.md` (the Terraform job): replace every `azure/deploy.sh` reference
- [x] 7.4 `.claude/skills/pr-review/SKILL.md` and `pr-comment-triage/SKILL.md`: the `NEXT_PUBLIC_*` checklist points at `infra/terraform/apps/web.tf` instead of `azure/monbo-frontend-app.yml`, and the deploy references are updated
- [x] 7.5 `CHANGELOG.md` (Unreleased → Changed): Terraform, `azure/` removed, the registry admin user off, new dev URLs
- [x] 7.6 Run `grep -rn "azure/deploy\|render_api_app\|deploy.env\|monbo-frontend-app"` outside archives. Only historical mentions may remain
- [x] 7.7 `infra/README.md`: how the Terraform code is organized, the role of each file type, how the stacks and scripts interact, where each value goes, the naming rules, adding an environment, and working on the code (fmt, validate, test, a real plan). Linked from the root README, `suggested_deployment.md` and `architecture.md`

## 8. Rebuild the development environment as `dev` (changes Azure — confirm with the user before each step)

- [x] 8.1 Create `infra/envs/dev.secrets.env` (subscription and secrets from the old `azure/deploy.env`), then `infra/bootstrap.sh`
  - Done by the user. The first run failed: the operators' Owner assignment (through an Entra group) carries an ABAC condition that only allowed assigning Reader. The subscription's unconditional Owner widened it to also allow Storage Blob Data Contributor/Owner/Reader, AcrPull, AcrPush and AcrDelete. Then the role on `monbotfstate` was granted. The design assumption "we have the permissions" held only after that change; change 5's CI identity will need the same kind of request.
- [x] 8.2 Plan and apply `platform` for `dev`. Check the lock, the soft delete, the backup protection and the registry admin user
  - Done by the user. The first apply created 9 of 11 resources. The backup `Register` job failed with a generic Azure Backup internal error (1073871825), most likely a timing issue right after the vault was created. A second plan/apply created the container registration, the protected share and the lock. Verified: protection `IRPending` (the first snapshot is taken at 06:00 UTC), lock `monbo-dev-data-no-delete`, registry admin user off. Azure Backup also adds its own `AzureBackupProtectionLock` on the storage account, which Terraform doesn't manage and which causes no drift.
- [x] 8.3 `tools/layers-ops/layers-ops.sh dev seed`: the three passkeys go to the password manager
  - Done by the user. The mapping is in `/tmp/monbo-seed-ids.json` (EC 0,1,2,4→0,1,2,3; CO 0,1,3→0,1,2; CR 0,1,5→0,1,2).
- [x] 8.4 `infra/deploy.sh dev`. Check that `/health` reports `/mnt/maps` as writable
  - Done by the user. Images `monbodevacr.azurecr.io/monbo-{api,front}:83fa85d`. API and web URLs on the environment's Container Apps domain.
- [x] 8.5 Parity:
  - diff the new API app against the reference from 1.1 (probes, mount, scale, env names, sizes);
  - smoke test the landing page (CO, CR, EC), one analysis per country, an admin login and an admin layer edit;
  - run `tests.regression.parity` against the old API with the seed's id mapping
  - Results (2026-10-05):
    - `/health` reports `/mnt/maps` writable, and the web `/api/health` returns 200.
    - `/countries` lists CO, CR and EC, with 3, 3 and 4 layers.
    - The diff against `.context/terraform/api.json` shows the same resources, env names, secret refs, volume and mount options, scale 1/1, ingress and revision mode. The only differences are explicit probe defaults that Azure used to fill in (`initialDelaySeconds` 0/1, startup `timeoutSeconds` 1), and the registry pulled by identity instead of a password.
    - `tests.regression.parity --mapping` against the local Git layers: **identical results on every regression farm and layer**.
    - The web bundles carry the new API URL, with no leftover placeholder or old URL; `/es` and `/es/admin` return 200.
    - **Still to do by hand:** an admin login with a seeded passkey, and an admin layer edit.
- [x] 8.6 Re-run `terraform plan` on both stacks: no changes, which shows the apply converged
  - Both plans report no changes (exit 0). The apps plan used the deployed images.
- [x] 8.7 Remove the old environment (D10 step 6):
  - stop the backup protection of `maps` in `monbo-backup`, deleting its data;
  - disable the vault's soft delete;
  - delete the vault;
  - remove the lock;
  - delete `monbo-data` and `monbo-test`.
  Record the commands used in `suggested_deployment.md`
  - Done on 2026-10-05, after the user verified an admin login and layer edits on `dev`.
    - The lock had to be removed **before** stopping protection, because it blocks that too.
    - The protected item's name is internal (`AzureFileShare;<hash>`).
    - `container unregister` failed with an internal error while the deleted item was in soft delete. It wasn't needed: the `AzureBackupProtectionLock` disappeared once protection stopped.
    - Then the storage `monbodata` was deleted, and the vault with `--force`. The vault's soft delete is `AlwaysON`, 14 days.
    - Both `monbo-data` and `monbo-test` are gone (`monbo-test` finished deleting after the Container Apps environment).
    - The runbook in `suggested_deployment.md` was rewritten with this order.
- [x] 8.8 Share the new dev URLs with the team (done by the user)

## 9. Wrap-up

- [x] 9.1 `openspec validate terraform-infrastructure`
- [x] 9.2 Open the PR into `dev`. The `Terraform` job runs; check that the package jobs are skipped unless touched
  - Added to #54. The CI run on the last push passed: `Detect changes` gave `api=true web=true infra=true`, and `Terraform` passed fmt, validate and the 4+5 tests. The first push failed Dependabot's config check, because `semver-major-days` isn't allowed for `terraform`; it was fixed. The PR is `CLEAN`. The subscription now holds only `monbo-dev-apps`, `monbo-dev-data`, `monbo-dev-platform` and `monbo-tfstate`.

## 10. Rollback on failed deploys (D12, added after cut-over)

- [x] 10.1 `infra/deploy.sh`:
  - record each app's serving image (latest ready revision) before applying;
  - after the apply, wait for each app's latest revision to be ready with the new image (fail fast on Failed/Degraded, about 10 minutes at most), then run the health checks;
  - on failure, re-apply the recorded images to both apps, verify them, and exit non-zero with the failed revision's `az containerapp logs show` command;
  - a cancelled interactive apply doesn't roll back, and a first deploy can't.
  shellcheck is clean
- [x] 10.2 Docs:
  - `infra/README.md`: the deploy steps, why a deploy never stays half-done, and "Considered and not adopted" (Terraform Stacks, Azure Deployment Stacks);
  - `docs/suggested_deployment.md`: Rollback;
  - design D12 and the spec scenarios
- [x] 10.3 Live test on `dev`: `TAG=rollbacktest ./infra/deploy.sh dev --skip-build --yes`, with `monbo-api:rollbacktest` an image that exits at once (azurelinux base) and `monbo-front:rollbacktest` the healthy web image. Expect: the API revision fails, both apps are rolled back to `83fa85d`, exit 1, and users keep the old revision throughout. Then delete the `rollbacktest` tags
  - Result (2026-10-06):
    - The `rollbacktest` API revision stayed `Activating` (never `Failed`), so it was caught by the 10-minute wait, not the fail-fast branch.
    - Throughout, `/health` answered 200 from the old revision: users saw nothing.
    - The script then applied `83fa85d` to both apps. Revisions `--0000002` came up ready, `/health` and the web app passed, and the script exited 1 with the failed revision's log command.
    - A follow-up plan with `83fa85d` shows no changes.
  - **Cleanup mistake, fixed:** `az acr repository delete --image monbo-front:rollbacktest` deletes the *manifest*, which `monbo-front:83fa85d` shared (the test tag was a copy of it). The serving web image was gone from the registry for a few minutes. It was re-pushed from the local Docker cache with the same digest (`sha256:f958975a…`). To drop a tag only, use `az acr repository untag`.
  - The run printed 67 `containerapp` extension warnings; `deploy.sh`'s `az containerapp` calls now pass `--only-show-errors`.

