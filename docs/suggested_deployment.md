# Suggested deployment (Azure Container Apps, Terraform)

The Azure environment is declared in Terraform under `infra/terraform/`, in two
stacks per environment. How the Terraform code is organized and how its pieces
interact is in [infra/README.md](../infra/README.md); what each resource does is in
[architecture.md](architecture.md).

| Stack | Holds | Applied |
|---|---|---|
| `platform` | The layers: data resource group with a delete lock, storage account and `maps` share, backups. Plus the container registry and the Log Analytics workspace | By hand, after reading its plan. Rarely changes |
| `apps` | The Container Apps environment, the pull identity, the API and web apps | By `infra/deploy.sh` on every deploy. Can be destroyed: the layers stay |

Each environment (`dev` today, deployed from the `dev` branch) is a pair of files per
stack: `envs/<env>.tfvars` (settings, no secrets) and `envs/<env>.backend.hcl` (where
its state lives).

```sh
./infra/deploy.sh dev                              # build, push, apply apps, verify
./infra/deploy.sh dev --plan-only                  # build and push, show the plan only
TAG=<tag> ./infra/deploy.sh dev --skip-build       # redeploy images already in the registry
tools/layers-ops/layers-ops.sh dev seed            # fill the share with the Git layers
tools/layers-ops/layers-ops.sh dev countries …     # countries and their admin passkeys (below)
```

**Requirements:** the az CLI (logged in with `az login`), Terraform ≥ 1.16, Docker,
curl, python3, and uv plus git-lfs for `seed` and `countries`.

**Secrets and the subscription** are environment variables, never files in Git: the
Google Maps keys and `ADMIN_SESSION_SECRET` as `TF_VAR_*`, and the subscription as
`ARM_SUBSCRIPTION_ID` (read by Terraform, the az calls and the scripts). Locally
`deploy.sh` and `layers-ops.sh` read them from `infra/envs/<env>.secrets.env`
(git-ignored: copy the `.example` next to it). In CI they come from the GitHub
Environment. They end up as Container App secrets, and in the Terraform state,
which is why the state account only accepts Entra ID access.

## Creating an environment from nothing

Once per subscription:

1. **State account.** `ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh` creates the
   resource group `monbo-tfstate` with the storage account `monbotfstate` (shared keys
   disabled, versioning and soft delete), and gives you `Storage Blob Data
   Contributor` on it. Those names are already in the backend files; if you pass
   another account name, update `envs/*.backend.hcl` and `state_storage_account_name`
   in `apps/envs/*.tfvars`. Grant the same role to other operators.

Then, per environment:

2. **Platform.** Export `ARM_SUBSCRIPTION_ID` (or source your secrets file), then:

   ```sh
   cd infra/terraform/platform
   terraform init -backend-config=envs/dev.backend.hcl
   terraform plan -var-file=envs/dev.tfvars -out=dev.tfplan   # read it
   terraform apply dev.tfplan
   ```

3. **Seed the share** with the Git-tracked layers (needs `git lfs pull` and uv):

   ```sh
   tools/layers-ops/layers-ops.sh dev seed
   ```

   It validates every raster and converts it to a Cloud Optimized GeoTIFF
   (`app.modules.layers.seed`), splits the layers by country
   (`app.modules.layers.migrate_countries`, which copies GFW and TMF into each
   country and numbers each country's layers from 0), and uploads the result to the
   share's root. It prints **one admin passkey per country**: put each one in the
   password manager straight away. It also writes each country's old id → new id to
   `/tmp/monbo-seed-ids.json` (`SEED_MAPPING_OUT`), for step 5.

4. **Deploy:** `./infra/deploy.sh dev`. It refuses a share without
   `countries.json`, and after the apply it checks that `/health` reports
   `mapsRoot: /mnt/maps` and `mapsRootWritable: true`. If it says it could not check
   the share, fix that error (network, storage firewall, key access) instead of
   seeding: `seed` empties a share that already holds layers. The first deploy of a
   fresh environment can fail pulling images while the new identity's `AcrPull`
   propagates; `deploy.sh` waits and retries once.

5. Optionally, compare the deployment with the Git layers on the regression farms.
   Every layer copy, in every country, must give the results of the original:

   ```sh
   cd apps/api
   MAPS_ROOT=app/maps uv run uvicorn app.main:app --port 8001 &
   uv run python -m tests.regression.parity --mapping /tmp/monbo-seed-ids.json \
     http://localhost:8001 <api-url>
   ```

**Adding an environment** (e.g. `prod`) is new `envs/prod.tfvars` and
`envs/prod.backend.hcl` files in both stacks (state keys `prod/platform.tfstate`,
`prod/apps.tfstate`) and an `infra/envs/prod.secrets.env`, then steps 2–4.

**Global names.** The storage account and the registry are named `monbo<env>data` and
`monbo<env>acr`: Azure only allows lowercase letters and digits in them, and they are
unique across all of Azure. If one is ever taken (for example a fork deployed to
another organization's subscription), set `unique_suffix` in `platform/envs/<env>.tfvars`;
it only changes those two names.

## Continuous deployment

Merging into `dev` deploys the `dev` environment: `.github/workflows/deploy.yml` runs
`infra/deploy.sh dev --yes`, with the same revision checks and rollback as a manual
deploy.

| A push to `dev` that changes | Deploys? |
|---|---|
| `apps/**`, `infra/deploy.sh`, `infra/lib.sh`, `infra/terraform/apps/**`, `deploy.yml` | Yes |
| Only docs, specs, `infra/terraform/platform/**`, tools | No (`platform` is applied by hand) |

- **One at a time.** Deploys queue up (`concurrency: deploy-dev`) and are never
  cancelled midway.
- **Failed deploys roll back.** A failed deploy rolls back both apps and fails the run.
  The run's summary says what happened and gives the failed revision's log command.
- **Manual runs.** *Actions → Deploy → Run workflow* (on `dev`) builds and deploys that
  commit, or, with a **tag**, redeploys images already in the registry, e.g. to go back
  to an earlier version.
- **Dependabot merges deploy too.** The usual caveat applies: a deploy interrupts a
  raster upload being processed (see
  [Deploying while the admin is in use](#deploying-while-the-admin-is-in-use)).

### How CI authenticates

GitHub Actions logs in as the managed identity **`monbo-dev-deploy`** (resource group
`monbo-dev-platform`, declared in the platform stack). There is no secret: its
federated credential trusts GitHub's OIDC token only for jobs of `undp/monbo` that run
in the GitHub Environment **`dev`**, and that environment only allows the `dev`
branch. Pull requests, including forks, can't obtain it.

Its roles:

| Role | Scope | Granted by |
|---|---|---|
| Reader | the subscription | Terraform (`platform`) |
| AcrPush | `monbodevacr` | Terraform |
| Storage Blob Data Contributor | `monbotfstate` (Terraform state) | Terraform |
| **Contributor** | **`monbo-dev-apps`** | **By hand, by an unconditional Owner** |
| **Storage Account Key Operator Service Role** | **`monbodevdata`** | **By hand, by an unconditional Owner** |

The operators' Owner role (group `Devs-Contributors`) carries an ABAC condition that
only lets them assign Reader, Storage Blob Data *, AcrPull, AcrPush and AcrDelete. The
last two roles are therefore granted once by an Owner without that condition, after
the platform stack has created the identity:

```sh
az account set --subscription "Monbo-DEV"
PRINCIPAL=$(az identity show -g monbo-dev-platform -n monbo-dev-deploy --query principalId -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Contributor" --scope "$(az group show -n monbo-dev-apps --query id -o tsv)"
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Storage Account Key Operator Service Role" \
  --scope "$(az storage account show -g monbo-dev-data -n monbodevdata --query id -o tsv)"
# Check: five roles
az role assignment list --assignee "$PRINCIPAL" --all --query "[].{role:roleDefinitionName, scope:scope}" -o table
```

Without them, a deploy fails with an authorization error (on `listKeys` or on the
apps resource group) before changing any app.

### The GitHub Environment `dev`

*Settings → Environments → dev*: deployment branches limited to `dev`, no required
reviewers (merging is the approval). Its secrets:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | `terraform -chdir=infra/terraform/platform output -raw deploy_identity_client_id` |
| `AZURE_TENANT_ID` | `terraform -chdir=infra/terraform/platform output -raw tenant_id` |
| `ARM_SUBSCRIPTION_ID` | as in `infra/envs/dev.secrets.env` |
| `TF_VAR_GCP_MAPS_PLATFORM_API_KEY` | as in `infra/envs/dev.secrets.env` |
| `TF_VAR_GCP_MAPS_PLATFORM_SIGNATURE_SECRET` | as in `infra/envs/dev.secrets.env` |
| `TF_VAR_ADMIN_SESSION_SECRET` | as in `infra/envs/dev.secrets.env` (leave unset to keep the admin off) |
| `TF_VAR_FRONT_GCP_MAPS_PLATFORM_API_KEY` | optional: a separate browser key |

Rotating a secret means updating it here (and in operators' secrets files), then
redeploying the current tag with a manual run.

### Setting it up for an environment

1. Apply the platform stack: it creates the identity, its federated credential and
   the three Terraform-managed roles.
2. An unconditional Owner grants the two manual roles (above).
3. Create the GitHub Environment and its secrets.
4. Merge, or run the workflow by hand. Check the run's summary and the environment's
   URL in GitHub.

**Turning it off:** disable the workflow (*Actions → Deploy → Disable workflow*);
`infra/deploy.sh` keeps working by hand.

## Layer storage

The API reads its layers from the `maps` Azure Files share mounted at `/mnt/maps`
(`MAPS_ROOT`), in the per-country layout the layers admin writes to
([maps.md](maps.md#per-country-layout)). The share outlives releases, restarts and new
revisions, and `terraform destroy` of the apps stack. The API image carries no layers
(the Git-tracked `apps/api/app/maps` is only the source the share is seeded from), and
an API that finds no layers at `MAPS_ROOT` refuses to start.

| Resource (`<env>` = dev) | Name | Why |
|---|---|---|
| Resource group | `monbo-<env>-data` | Separate from the apps, so destroying them can't delete the layers |
| Delete lock | `monbo-<env>-data-no-delete` (`CanNotDelete`) | Nothing in the group can be deleted by mistake |
| Storage account / share | `monbo<env>data` / `maps` (10 GiB, SMB) | TLS 1.2+, HTTPS only, no public blob access |
| Share soft delete | 14 days | A deleted share can be undeleted |
| Azure Backup | vault `monbo-<env>-backup`, policy `maps-daily-30d` | Daily snapshot at 06:00 UTC, kept 30 days |
| Environment storage | `maps` on the Container Apps environment (apps stack) | What the API's volume refers to |

The storage account, the share, the vault and the protected share also carry
Terraform's `prevent_destroy`: destroying them takes a code change, removing the lock
and stopping the backup protection, on purpose.

The volume is mounted with `uid=10001,gid=10001,dir_mode=0750,file_mode=0640`: the
API image runs as uid/gid 10001 (`apps/api/Dockerfile.prod`), and `chmod` is not
possible on the share.

The API is pinned to one replica: the lock that serializes writes to the share, the
login rate limit and the single ingestion slot live in the API's memory. Don't scale
it out while the admin is enabled.

Terraform owns both apps entirely (`infra/terraform/apps/api.tf`, `web.tf`): change
their settings there or in `envs/<env>.tfvars`, never in the portal. A portal change
shows up in the next plan and is reverted by the next deploy.

### Starting an environment's layers over

`tools/layers-ops/layers-ops.sh <env> seed` also works on a share that already has
layers. After you type the share's name to confirm, it prepares the new layers,
**deletes every file on the share** (layers, raster versions, admin edits, ingestion
jobs), and uploads the Git-tracked layers again. Every country gets a new passkey.

Before emptying the share, `seed` takes a snapshot of it and prints its timestamp:
that is the one to restore (see [Rollback](#rollback)), since the daily backup may be
hours old. `countries.json` is uploaded last, so if the upload dies midway the share
has none and `deploy.sh` refuses to deploy on it: run `seed` again. The running API
keeps serving during the swap, so analyses, tiles and the admin fail until the upload
ends, and admin edits made meanwhile are lost: run it when nobody is using the
environment.

### Deploying while the admin is in use

Don't deploy while a raster upload is being processed (the admin page shows the job
as queued or running). During a deploy the previous revision keeps serving until the
new one is ready, so for a moment two API processes share the layers. The new revision
leaves a job that is still being updated alone and refuses new uploads until it ends,
but a deploy that stops the old revision mid-job fails that upload: the admin sees it
as interrupted (after up to 15 minutes) and has to upload the raster again.

### Rollback

- **A failed deploy rolls itself back.** Before applying, `infra/deploy.sh` notes the
  image of each app's last healthy revision. If the apply fails, a new revision doesn't
  become ready with the new image, or the API doesn't read a writable `/mnt/maps`, it
  applies those images again for both apps and exits with an error and the command to
  read the failed revision's logs. Users keep reaching the previous revision
  throughout. A first deploy has nothing to roll back to.
- **Back to an earlier image:** `TAG=<tag> ./infra/deploy.sh <env> --skip-build`
  redeploys images already in the registry, with the same share. As with any deploy,
  don't do it while a raster upload is being processed (see above).
- **Back to the Git layers:** `tools/layers-ops/layers-ops.sh <env> seed` rebuilds the
  share from the Git-tracked layers (it snapshots the current content first). Admin
  changes are lost.
- **Restoring files:** use the vault's "Restore" on the `maps` item in the Azure
  portal (whole share or single files), or undelete the share within 14 days.
- **Infrastructure changes:** revert the commit and apply again; the state account
  keeps earlier state versions if a state ever needs recovering.

## Layers admin

With `TF_VAR_admin_session_secret` set (and layer storage in the per-country layout),
the admin is available at `https://<frontend>/admin`. Each country's admin logs in
with their own passkey and only sees their country's layers. Generate the secret with:

```sh
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Terraform stores it as a Container App secret and sets `ADMIN_ALLOWED_ORIGIN` to the
frontend's Container Apps URL by default. Rotating it (replace it in the secrets file
or the GitHub Environment, then `TAG=<deployed tag> ./infra/deploy.sh <env>
--skip-build`) signs every admin of every country out. How to manage layers is in
[maps.md](maps.md).

**Custom domains.** If the frontend is served from its own domain, set
`admin_allowed_origin` (for example `https://monbo.example.org`) in
`apps/envs/<env>.tfvars`: the admin rejects calls from any other origin. A custom
domain bound directly to the Container Apps keeps the login rate limit working,
because it keys on the client IP that the Container Apps ingress appends to
`X-Forwarded-For`. A proxy in front of the API (Front Door, Application Gateway) would
become that IP for everyone, so 5 wrong guesses from anyone would block all admins:
that setup needs the API to trust the proxy's hop first.

### Countries and admin passkeys

Each country's passkey hash lives in the share's `countries.json`, not in Azure or
Terraform. `layers-ops.sh countries` edits it without redeploying: the API applies the
change on its next request. The command needs the `azure` uv dependency group, which
`uv run` installs from `apps/api/uv.lock`.

```sh
tools/layers-ops/layers-ops.sh dev countries list         # countries, their state and layers
tools/layers-ops/layers-ops.sh dev countries add PE       # new country (empty); prints its passkey once
tools/layers-ops/layers-ops.sh dev countries rotate CR    # new passkey for CR; its sessions end
tools/layers-ops/layers-ops.sh dev countries disable EC   # hidden from the app, admin locked out
tools/layers-ops/layers-ops.sh dev countries enable EC
tools/layers-ops/layers-ops.sh dev countries unlock       # recover after an interrupted update
```

It runs the same command as `uv run python -m app.modules.admin.countries` on a local
copy of the registry, then leases `countries.json`, checks its ETag and uploads it. If
someone else changed the registry meanwhile, it stops without uploading; run it again.
For `add`, the new passkey is printed only after the folder and registry are uploaded.

If a process dies during an update, Azure Files can retain its file lease. After
checking that no `countries` command is still running, use `countries unlock` to
break that lease and retry the update.

- **Adding a country**: `countries add <code>`, then give the passkey to that
  country's admin. The country appears on the landing page once it publishes a layer.
  Its GFW and TMF need their own rasters: the current ones only cover Ecuador,
  Colombia and Costa Rica.
- **A leaked passkey**: `countries rotate <code>`. Only that country is affected.
- Keep each passkey in the password manager and share it only with that country's
  admin. It is never stored anywhere else.
- **Never put the hash of a chosen password in `countries.json`.** Only an unsalted
  SHA-256 of each passkey is stored, which is safe for the random passkeys `add` and
  `rotate` generate, but not for a memorable password: anyone who gets the hash could
  recover a weak passkey offline, and the login rate limit would then be the only
  protection. If a country's hash ever came from a chosen password, `rotate` it.

## Removing the pre-Terraform environment

Before Terraform, `azure/deploy.sh` (removed; see the Git history) built the
environment in `monbo-test` (apps, registry `monboacr`) and `monbo-data` (storage
`monbodata`, vault `monbo-backup`, lock `monbo-data-no-delete`). They were removed on
2026-10-05, once the `dev` environment served and matched the Git layers. These are
the steps that worked, in this order, for any environment built the same way:

```sh
az account set --subscription "$ARM_SUBSCRIPTION_ID"
# 1. The group's lock first: it also blocks stopping the backup protection.
az lock delete -g monbo-data -n monbo-data-no-delete
# 2. Stop protecting the share and delete its backups. The item's name is internal
#    (AzureFileShare;<hash>): look it up.
item=$(az backup item list -g monbo-data -v monbo-backup --backup-management-type AzureStorage \
  --workload-type AzureFileShare --query "[?properties.friendlyName=='maps'].name" -o tsv)
az backup protection disable -g monbo-data -v monbo-backup \
  --container-name "StorageContainer;Storage;monbo-data;monbodata" --item-name "$item" \
  --backup-management-type AzureStorage --workload-type AzureFileShare \
  --delete-backup-data true --yes
# 3. The storage account (its AzureBackupProtectionLock goes away once protection stops),
#    then the vault: the deleted backups stay in soft delete, so it needs --force.
az storage account delete -g monbo-data -n monbodata --yes
az backup vault delete -g monbo-data -n monbo-backup --yes --force
# 4. The groups.
az group delete -n monbo-data --yes
az group delete -n monbo-test --yes        # the Container Apps environment takes a while
```

`az backup container unregister` fails with a generic internal error while the
deleted item is in soft delete; it isn't needed, step 3 works without it.

**Vault soft delete is always on.** New Recovery Services vaults (the old one and
`monbo-<env>-backup`) come with soft delete in `AlwaysON` mode, 14 days, which can't
be turned off: backups deleted by mistake can be recovered for 14 days, even by
someone who can delete them. Together with the lock and `prevent_destroy`, that is the
layers' protection. It also means a vault's deleted backups outlive the vault for
14 days.

## Making the Terraform check required

The `CI` workflow's `Terraform` job (fmt, validate, mocked tests) runs on pull
requests that change `infra/`, but is not a required check. To require it, add
`Terraform` to the `required_status_checks` of both rulesets
([branch_protection.md](branch_protection.md#how-to-apply-it)). Because it is skipped
by its own condition when `infra/` doesn't change, requiring it doesn't block other
pull requests.
