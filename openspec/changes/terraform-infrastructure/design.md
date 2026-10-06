## Context

Today `azure/deploy.sh` (bash, about 700 lines) and `azure/render_api_app.py` build the test environment in subscription `Monbo-DEV` (`eastus2`):

| Resource group | Resources | Created by |
|---|---|---|
| `monbo-test` | ACR `monboacr` (Basic, **admin user on**), Container Apps env `monbo-env`, an auto-created Log Analytics workspace, Container Apps `monbo-api` and `monbo-front` | `ensure_infrastructure`, `deploy_api`, `deploy_front` |
| `monbo-data` | Storage `monbodata` + share `maps` (10 GiB, SMB, 14-day soft delete), Recovery Services vault `monbo-backup` with policy `maps-daily-30d`, a `CanNotDelete` lock | `ensure_layer_storage`, `ensure_share_backup` |

The API app is PUT whole from `render_api_app.py`:

- image, 1 CPU / 2 GiB, one replica;
- external ingress on 8000;
- startup and readiness probes on `/health`, liveness on `/health/live`;
- the `maps` Azure Files volume at `/mnt/maps` (`uid=10001,gid=10001,dir_mode=0750,file_mode=0640`) and `MAPS_ROOT`;
- secrets for the registry password, the two Google Maps keys and, optionally, `ADMIN_SESSION_SECRET`, plus `ADMIN_ALLOWED_ORIGIN`.

The web app is created with `az containerapp create`: 0.5 CPU / 1 GiB, ingress on 3000, and seven `NEXT_PUBLIC_*` variables substituted at container start by `entrypoint.sh`.

Around those resources, the script also:

- registers resource providers;
- refuses to mount a share without `countries.json`;
- waits for the new revision and verifies `/health`;
- seeds the share from Git;
- manages the country registry on the share with an ETag and lease protocol (`app.modules.admin.azure_registry`).

Decisions already taken in exploration:

- **Terraform**, for the whole environment;
- **parametrized per environment**, with only `dev` this cycle (deployed from the `dev` branch; it replaces the old `monbo-test`);
- **secrets** in GitHub Environment secrets (change 5) passed as `TF_VAR_*`, and the **subscription id kept out of the repository** too (`ARM_SUBSCRIPTION_ID`);
- **rebuild from scratch, not import:** the only data worth keeping is the Git layers;
- **permissions** to assign roles are assumed available.

The azurerm 5.8 schema was checked before writing this design. It has:

- `mount_options` on Container App volumes;
- all three probes;
- registry pulls by identity;
- `share_properties.retention_policy`;
- the `azurerm_backup_*_file_share` resources;
- `azurerm_federated_identity_credential`.

## Goals / Non-Goals

**Goals:**

- `terraform plan` shows the whole environment, and a portal change shows up as drift.
- Everything holding data survives `terraform destroy` of the apps, and can't be destroyed by accident.
- Same runtime behaviour as today: probes, scale, mount, env vars, secrets, sizes.
- A second environment is a new tfvars and backend file.
- No secret in the repository. No registry password anywhere.
- One deploy entry point, the same locally and in CI (change 5).

**Non-Goals:**

- The CI deploy workflow and its OIDC identity (change 5). This change only leaves the hooks.
- Production. Only `dev` is created.
- Splitting the API into read and write apps, App Insights, custom domains, a VNet, Key Vault.
- Changing `seed`, the migration or the registry protocol. Their code stays in `apps/api`; only their entry point moves.

## Decisions

### D1. Two stacks per environment, plus a bootstrap script

```
infra/
├── bootstrap.sh                 # once per subscription: the Terraform state account
├── deploy.sh <env>              # build+push, seeded-share check, apply apps, verify /health
└── terraform/
    ├── platform/                # long-lived · prevent_destroy on data
    │   ├── *.tf
    │   ├── .terraform.lock.hcl
    │   └── envs/dev.tfvars, envs/dev.backend.hcl
    └── apps/                    # destroyable · applied on every deploy
        ├── *.tf
        ├── .terraform.lock.hcl
        └── envs/dev.tfvars, envs/dev.backend.hcl
tools/layers-ops/layers-ops.sh <env> seed | countries …
```

- **Why `platform` and `apps`.** Their lifecycles and blast radius differ. `apps` is applied on every deploy and may be destroyed. `platform` changes rarely and holds the data. They also have to be ordered: images must be in the registry (platform) before an apply creates Container Apps that reference them (apps).
- **What `apps` reads from `platform`.** It reads `platform`'s outputs through `terraform_remote_state`: registry id and login server, storage account id and name, share name, Log Analytics id.
- **Alternative: one stack with `-target`.** Rejected: `-target` is an escape hatch, not a workflow, and a single state would put the data under every deploy's apply.
- **Alternative: Terraform workspaces for environments.** Rejected: backend config per environment is explicit and keeps each environment's state in its own key. Workspaces hide which one is selected.

### D2. Resource groups and names

Each environment `<env>` gets three resource groups:

- `monbo-<env>-data`: storage, vault and lock;
- `monbo-<env>-platform`: registry and Log Analytics;
- `monbo-<env>-apps`: Container Apps environment, identity and apps.

The registry and Log Analytics sit outside the locked data group, so deleting old images or the workspace isn't blocked by the lock, and losing them loses nothing irreplaceable.

Two names are global across Azure and only accept lowercase letters and digits: the storage account (3–24 characters) and the registry (5–50). They are `monbo<env>data` and `monbo<env>acr`, for example `monbodevdata` and `monbodevacr`; both were checked as available. An optional `unique_suffix` (empty by default) is inserted only if a name is ever taken, for example by a fork deployed to another organization's subscription. The other names keep hyphens: `monbo-<env>-…`. New names avoid any collision with the old resources during cut-over (D10).

### D3. Remote state

`infra/bootstrap.sh` (az CLI, idempotent) creates `monbo-tfstate` with:

- a storage account: Standard_LRS, TLS 1.2, no public access, shared keys **disabled**, blob versioning and 30-day soft delete;
- a `tfstate` container;
- `Storage Blob Data Contributor` for the operator running it.

Backends use `use_azuread_auth = true`, so no account key is ever needed. The account is `monbotfstate`, and the keys are `<env>/platform.tfstate` and `<env>/apps.tfstate`. `bootstrap.sh` reads the subscription from `ARM_SUBSCRIPTION_ID`, like everything else.

- **Alternative: Terraform for the bootstrap.** Rejected: its own state would sit on a laptop and contain the account's keys. The script is short and has nothing to drift.

### D4. Data protection

In `platform`:

- **Storage account:** `min_tls_version = "TLS1_2"`, `allow_nested_items_to_be_public = false`, HTTPS only.
- **Share soft delete:** `share_properties.retention_policy.days = 14`.
- **Share:** `maps`, quota 10, SMB.
- **Backup:** a Recovery Services vault, with `azurerm_backup_policy_file_share`: daily at 06:00 UTC, retention 30. The storage account is registered as a backup container and the share is protected.
- **Lock:** `azurerm_management_lock` `CanNotDelete` on the data resource group.
- **`lifecycle { prevent_destroy = true }`** on the storage account, the share, the vault and the protected item.

Azure also creates new Recovery Services vaults with soft delete in `AlwaysON` mode (14 days), which can't be turned off. Deleted backups stay recoverable for 14 days, and they outlive a deleted vault. This was verified on both the old vault and `monbo-dev-backup`.

Destroying data therefore takes three deliberate steps:

1. a code change removing `prevent_destroy`;
2. removing the lock;
3. stopping the backup protection.

### D5. Registry pulls by identity, not admin credentials

The registry is created with `admin_enabled = false`. In `apps`, a user-assigned identity gets `AcrPull` on the registry. Both apps use it through `registry { identity = … }` and `identity { type = "UserAssigned" }`. The registry password secret disappears.

The role assignment takes a minute to propagate before the first image pull. `apps` makes the Container Apps depend on the assignment, and the first apply after a fresh `platform` may need a retry. `deploy.sh` retries once on that specific failure.

### D6. Container Apps mirror today's definitions

The `apps` stack reproduces `render_api_app.py` field by field:

- single revision mode;
- `min_replicas = max_replicas = 1`;
- the three probes with the same paths and timings;
- the volume with the same mount options;
- `MAPS_ROOT=/mnt/maps`;
- secrets as Container App secrets referenced by env vars;
- `ADMIN_SESSION_SECRET` and `ADMIN_ALLOWED_ORIGIN` only when the secret is set (a `dynamic` block).

The web app reproduces `deploy_front`'s env vars, sizes and ingress, and gains a startup probe on `/api/health`.

The URLs avoid a cycle between the two apps. Both are computed from the Container Apps environment's `default_domain`:

- `NEXT_PUBLIC_API_URL = https://<api-name>.<default_domain>`;
- `ADMIN_ALLOWED_ORIGIN = https://<web-name>.<default_domain>`, unless an override variable is set.

This is exactly what `deploy.sh` did.

The PUT-replaces-the-app behaviour of `render_api_app.py`, and its carry-over of portal-only settings, disappear. Terraform owns the whole app, and a portal edit shows as drift.

### D7. Variables and secrets

- **Non-secret settings live in `envs/<env>.tfvars`:**
  - location and the optional suffix;
  - sizes;
  - thresholds, testing banner, satellite request cap, contact URL;
  - admin enabled or not.
- **The subscription is not a variable.** The provider reads `ARM_SUBSCRIPTION_ID`, which comes from the same place as the secrets, so no repository file names it.
- **Secrets are `sensitive = true` variables with no defaults:**
  - `gcp_maps_platform_api_key`;
  - `gcp_maps_platform_signature_secret`;
  - `front_gcp_maps_platform_api_key` (optional, defaults to the API key);
  - `admin_session_secret` (optional).
- **Where the secrets come from:**
  - for an operator, `infra/deploy.sh` loads them from a git-ignored `infra/envs/<env>.secrets.env` as `TF_VAR_*`;
  - in CI (change 5), from GitHub Environment secrets.
- **Validation in Terraform:** the admin secret has at least 32 characters, and CPU/memory are a valid Container Apps pair.

The secrets end up in the state, which is why the state account is RBAC-only (D3).

### D8. `infra/deploy.sh <env>`: one entry point

The steps, which replace `deploy.sh`'s default command:

1. Check the tools (az, docker, terraform, curl). Read `ARM_SUBSCRIPTION_ID` and select that subscription.
2. Read the `platform` outputs (registry, storage, share).
3. **Refuse an unseeded share.** If `countries.json` is missing, stop with instructions to run `tools/layers-ops … seed`. Terraform has no data source for a file on a share, so this stays a script check.
4. Build and push `monbo-api` and `monbo-front` for `linux/amd64`, tagged with the short commit SHA (`--skip-build` reuses a tag).
5. `terraform apply` on `apps`, with `-var api_image=… -var web_image=…`. Optionally `--plan-only`.
6. Verify that `/health` reports `mapsRoot=/mnt/maps` and writable, and that the web `/api/health` answers. This is `verify_maps_root` and `wait_for_health`, ported.

Applying `platform` is a separate, explicit command (`terraform -chdir=infra/terraform/platform apply -var-file=…`), documented in `suggested_deployment.md`. It changes rarely, and its plan deserves a human read.

### D9. Data-plane tools move to `tools/layers-ops/`

`layers-ops.sh <env> seed` and `layers-ops.sh <env> countries <cmd> [CC]` port `seed_share` and `countries` verbatim:

- confirmation by typing the share name;
- snapshot before emptying;
- `countries.json` uploaded last;
- the ETag and lease protocol;
- `unlock`.

The only difference is where the names come from: the `platform` outputs instead of `deploy.env`. They stay operator-run and are never run in CI. `seed` prints passkeys and needs the 511 MB of LFS rasters.

### D10. Rebuild, then remove the old environment

1. Run `bootstrap.sh`.
2. Apply `platform` for `dev`, under the new names.
3. Run `layers-ops.sh dev seed`: three passkeys, kept in the password manager.
4. Run `infra/deploy.sh dev`.
5. Smoke test:
   - the landing page lists CO, CR and EC;
   - one analysis;
   - an admin login.
   Compare a regression sample with `tests.regression.parity` against the old deployment, while it still exists.
6. Remove the old groups:
   - stop the backup protection of `maps` in `monbo-backup`, deleting its data;
   - disable the vault's soft delete, or wait out its retention;
   - delete the lock;
   - delete `monbo-data`, then `monbo-test`.
   The commands go in the tasks and in `suggested_deployment.md` § "Removing the pre-Terraform environment". When this was run, the lock had to go **first**, because it also blocks stopping protection. The vault, with its deleted backups in soft delete, needed `az backup vault delete --force`.

The development URLs change. Whoever uses them is told, and `ADMIN_ALLOWED_ORIGIN` follows automatically.

### D11. Terraform in CI and Dependabot

- **Change detection** gains `infra=true` for `infra/**`, and `ci.yml` changes select it too.
- **A `Terraform` job** (fail-open like the others) runs, for each stack:
  - `terraform fmt -check -recursive`;
  - `init -backend=false`;
  - `validate`.
  It has no Azure credentials and no plan; planning in CI comes with change 5's identity.
- **The job is not a required check.** Adding it to the rulesets is a one-line decision left to the maintainers, and it is documented.
- **Versions:** Terraform is pinned in `required_version` and in the job (`hashicorp/setup-terraform`, SHA-pinned). The `.terraform.lock.hcl` files are committed for `linux_amd64` and `darwin_arm64`.
- **Dependabot** gets a `terraform` entry per stack directory.

### D12. A failed deploy rolls itself back (added after cut-over)

The first port of `deploy.sh` checked only `/health` after the apply. That was a regression: the old script waited for `latestRevisionName == latestReadyRevisionName`. In single revision mode the previous revision keeps serving until the new one is ready, so a revision that never starts is invisible to users, and also to a `/health` check. Terraform still records the new image, and the deploy reports success. A failure halfway (API updated, frontend not) leaves mismatched versions.

`deploy.sh` now:

1. records the image of each app's latest ready revision before applying;
2. after the apply, waits for each app's latest revision to be ready and running the new image, failing fast on a `Failed` or `Degraded` revision, then checks `/health` and the web app;
3. on any failure, applies the recorded images to both apps (auto-approved, since the operator already approved the deploy), verifies them, and exits non-zero with the failed revision's log command.

Only the apps stack rolls back. `platform` is applied by hand after reading its plan, and a partial `platform` apply converges on retry, as the backup registration did.

- **Alternative: Terraform Stacks.** An HCP Terraform feature: runs and state live in HCP Terraform, connected to GitHub, with OIDC. It orchestrates components and several deployments of one configuration, and it has no rollback of a failed apply. Rejected: it would move the state out of Azure into a SaaS account, for orchestration that two stacks plus remote state already cover with one environment. Revisit with several environments or regions.
- **Alternative: Azure Deployment Stacks.** Bicep/ARM-only, so it means rewriting the Terraform, and it has no rollback either: a failed stack stays failed. ARM's `--rollback-on-error` applies only to plain ARM deployments. Its deny settings are covered by the lock, `prevent_destroy` and drift detection.

## Risks / Trade-offs

- **[Risk] Destroying data by mistake.** → Mitigation: the three-step protection in D4. Plans of `platform` are read before applying, and `deploy.sh` never applies `platform`.
- **[Risk] Secrets in the state.** → Mitigation: an RBAC-only state account (no shared keys), versioning, and access limited to operators and, in change 5, the deploy identity.
- **[Risk] `AcrPull` propagation delay** fails the first apply after a new `platform`. → Mitigation: the dependency ordering plus one retry in `deploy.sh` (D5).
- **[Risk] Recovery Services vault deletion is slow**, because of backup soft delete. This only matters when removing the old environment. → Mitigation: the new environment uses new names, so the old vault's deletion doesn't block anything. The runbook covers stopping protection with data deletion.
- **[Risk] Behaviour drift from today's apps** (a probe timing, a mount option). → Mitigation: a task diffs the rendered `render_api_app.py` body against `az containerapp show` of the new API app before the old environment is deleted.
- **[Trade-off] URL change** for the development environment.
- **[Trade-off] Two stacks** mean two plans, and `platform` must be applied before `apps` reads its outputs.
- **[Trade-off] The unseeded-share check lives in a script.** Terraform alone, applied directly, would create an API that refuses to start. The API's own startup check (change 1) makes that failure loud.

## Migration Plan

D10 is the migration.

**Rollback:** until step 6, the old environment is untouched and still serves. If the new one has problems, keep using the old URLs, fix forward or `terraform destroy` the new `apps` stack, and run the previous release's `azure/deploy.sh` from its tag. After step 6, rollback means re-applying.

## Open Questions

None. `unique_suffix` stays empty: `monbodevdata` and `monbodevacr` are available.
