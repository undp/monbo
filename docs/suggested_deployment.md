# Suggested deployment (Azure Container Apps, Terraform)

The Azure environment is declared in Terraform under `infra/terraform/`, in two
stacks per environment. How the Terraform code is organized and how its pieces
interact is in [infra/README.md](../infra/README.md); what each resource does is in
[architecture.md](architecture.md).

| Stack | Holds | Applied |
|---|---|---|
| `platform` | The layers (storage account and `maps` share), the container registry, the Log Analytics workspace and the deploy identity | By hand, after reading its plan. Rarely changes |
| `apps` | The Container Apps environment, the pull identity, the API and web apps | By `infra/deploy.sh` on every deploy. Can be destroyed: the layers stay |

There are two environments: `dev`, deployed from the `dev` branch, and `prod`, deployed
from `main` once it is set up ([Production](#production)). Each is a pair of files per
stack: `envs/<env>.tfvars` (settings, no secrets) and `envs/<env>.backend.hcl` (where
its state lives).

**One resource group per environment, and nothing that needs more than Contributor on
it.** Production runs in the one existing group UNDP granted, where the operators can't
create groups, assign roles or create locks. `dev` is prod's test environment, so it
uses the same layout in its own group (`monbo-dev`): what `dev` deploys is what `prod`
runs. Terraform reads the group, never creates, modifies or locks it, and assigns no
roles: an administrator grants the two identities their roles once
([The administrator's grants](#the-administrators-grants)).

| | `dev` | `prod` |
|---|---|---|
| Subscription | Inventures' | UNDP's (another Entra tenant) |
| Resource group | `monbo-dev` (created by `bootstrap.sh`) | the one UNDP granted, shared with other UNDP apps |
| Region | `eastus` | `eastus` |
| State account | `monbodevtfstate` | `monboprodtfstate` |
| Names | `monbodevdata`, `monbodevacr`, `monbo-dev-*` | `monboproddata`, `monboprodacr`, `monbo-prod-*` |
| Testing banner | shown | hidden |

```sh
./infra/deploy.sh dev                              # build, push, apply apps, verify
./infra/deploy.sh dev --plan-only                  # build and push, show the plan only
TAG=<tag> ./infra/deploy.sh dev --skip-build       # redeploy images already in the registry
tools/layers-ops/layers-ops.sh dev seed            # fill the share with the Git layers
tools/layers-ops/layers-ops.sh dev countries …     # countries and their admin passkeys (below)
```

**Requirements:** the az CLI (logged in with `az login`, into the environment's
tenant), Terraform ≥ 1.16, Docker, curl, python3, and uv plus git-lfs for `seed` and
`countries`. UNDP's conditional access asks for a new `az login` every 24 hours: an
error about an expired refresh token (`AADSTS70043`) means signing in again.

**Secrets, the subscription and the group** are environment variables, never files in
Git: the Google Maps keys and `ADMIN_SESSION_SECRET` as `TF_VAR_*`, the subscription as
`ARM_SUBSCRIPTION_ID`, and the environment's resource group as
`TF_VAR_resource_group_name` (read by Terraform, the az calls and the scripts;
`lib.sh` also passes it to the backends). The repository is public: account-specific
names, like prod's group, which is UNDP's, stay out of it. Locally
`deploy.sh` and `layers-ops.sh` read them from `infra/envs/<env>.secrets.env`
(git-ignored: copy the `.example` next to it). In CI they come from the GitHub
Environment. They end up as Container App secrets, and in the Terraform state.

**The Terraform state** is read with the state account's key, because Contributor
can't grant anyone a data role on the account. `infra/lib.sh` fetches the key with
your Azure login and exports it as `ARM_ACCESS_KEY` before every `terraform init`;
it is never written to disk. Running Terraform by hand, export it the same way first:

```sh
export ARM_ACCESS_KEY="$(az storage account keys list -g <group> -n <state account> --query '[0].value' -o tsv)"
```

Anyone who can list the account's keys can read the state, which holds the secrets:
the same people who can already change the resources. Versioning and soft delete keep
earlier states.

## Creating an environment from nothing

With `infra/envs/<env>.secrets.env` filled in, `git lfs pull` done, Docker running and
`az login` into the environment's tenant (`dev` shown; for `prod` see
[Production](#production)):

1. **GitHub Environment `<env>`**, deployment branches limited to its branch, no
   secrets yet ([below](#the-github-environments-dev-and-prod)). It must exist before
   step 3 creates the federated credential that trusts it.
2. **Group and state account.**

   ```sh
   ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh monbo-dev monbodevtfstate eastus
   ```

   It creates the group if it doesn't exist (an existing one is left untouched), and
   the state account in it, with versioning and soft delete.
3. **Platform.**

   ```sh
   set -a; source infra/envs/dev.secrets.env; set +a
   export ARM_ACCESS_KEY="$(az storage account keys list -g "$TF_VAR_resource_group_name" -n monbodevtfstate --query '[0].value' -o tsv)"
   cd infra/terraform/platform
   terraform init -reconfigure -backend-config=envs/dev.backend.hcl \
     -backend-config="resource_group_name=$TF_VAR_resource_group_name"
   terraform plan -var-file=envs/dev.tfvars -out=dev.tfplan   # read it
   terraform apply dev.tfplan
   ```

4. **Seed the share** with the Git-tracked layers:

   ```sh
   tools/layers-ops/layers-ops.sh dev seed
   ```

   It validates every raster and converts it to a Cloud Optimized GeoTIFF
   (`app.modules.layers.seed`), splits the layers by country
   (`app.modules.layers.migrate_countries`, which copies GFW and TMF into each
   country and numbers each country's layers from 0), and uploads the result to the
   share's root. It prints **one admin passkey per country**: put each one in the
   password manager straight away. It also writes each country's old id → new id to
   `/tmp/monbo-seed-ids.json` (`SEED_MAPPING_OUT`), for step 8.
5. **First deploy, by hand:** `./infra/deploy.sh dev`. The apps pull with the
   registry's admin user (`registry_admin_enabled = true`), so nothing waits on a
   role. It refuses a share without `countries.json`, and after the apply it checks
   that `/health` reports `mapsRoot: /mnt/maps` and `mapsRootWritable: true`. If it
   says it could not check the share, fix that error (network, storage firewall, key
   access) instead of seeding: `seed` empties a share that already holds layers.
6. **The administrator's grants** ([below](#the-administrators-grants)), then
   `registry_admin_enabled = false` in `platform/envs/dev.tfvars`, apply `platform`
   (it turns the registry's admin user off) and `./infra/deploy.sh dev` (the apps
   switch to the pull identity).
7. **CI:** the GitHub Environment's secrets, with the client and tenant ids from the
   platform outputs. For `prod`, also `DEPLOY_PROD` = `true`.
8. Optionally, compare the deployment with the Git layers on the regression farms.
   Every layer copy, in every country, must give the results of the original:

   ```sh
   cd apps/api
   MAPS_ROOT=app/maps uv run uvicorn app.main:app --port 8001 &
   uv run python -m tests.regression.parity --mapping /tmp/monbo-seed-ids.json \
     http://localhost:8001 <api-url>
   ```

**Adding an environment** is new `envs/<env>.tfvars` and `envs/<env>.backend.hcl`
files in both stacks (state keys `<env>/platform.tfstate`, `<env>/apps.tfstate`, its
state account) and an `infra/envs/<env>.secrets.env` (with the group as
`TF_VAR_resource_group_name`), then the steps above.

**Global names.** The storage accounts and the registry are named `monbo<env>data`,
`monbo<env>tfstate` and `monbo<env>acr`: Azure only allows lowercase letters and
digits in them, and they are unique across all of Azure. If the data account or the
registry is ever taken, set `unique_suffix` in `platform/envs/<env>.tfvars`; it only
changes those two names.

### The administrator's grants

Terraform assigns no roles, so someone allowed to assign them makes two grants once,
after step 5 has created both identities. In UNDP's subscription, a UNDP
administrator. In Inventures', the operators' Owner role carries an ABAC condition that
allows AcrPull but not Contributor, so an Owner without that condition grants
Contributor:

| Role | Scope | For | What it enables |
|---|---|---|---|
| **Contributor** | the environment's group | `monbo-<env>-deploy` | CI: applying the apps, reading the storage and state keys, pushing images (Contributor includes push on the registry) |
| **AcrPull** | the registry `monbo<env>acr` | `monbo-<env>-pull` | Pulls by managed identity, so the registry's admin user can be turned off |

The principal ids, for the request:

```sh
terraform -chdir=infra/terraform/platform output -raw deploy_identity_principal_id   # monbo-<env>-deploy
terraform -chdir=infra/terraform/apps output -raw pull_identity_principal_id         # monbo-<env>-pull
```

The commands, for the administrator:

```sh
GROUP=monbo-dev; ACR=monbodevacr          # prod: the group UNDP granted, monboprodacr
az account set --subscription <the environment's subscription>
GROUP_ID=$(az group show -n "$GROUP" --query id -o tsv)
ACR_ID=$(az acr show -g "$GROUP" -n "$ACR" --query id -o tsv)
az role assignment create --assignee-object-id <deploy principal id> \
  --assignee-principal-type ServicePrincipal --role Contributor --scope "$GROUP_ID"
az role assignment create --assignee-object-id <pull principal id> \
  --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID"
# Check
az role assignment list --scope "$GROUP_ID" \
  --query "[?principalType=='ServicePrincipal'].{role:roleDefinitionName, principal:principalId, scope:scope}" -o table
```

Without the first, a CI deploy fails with an authorization error before changing any
app. Without the second, keep `registry_admin_enabled = true`.

Optional, each restoring a protection the layers had before
([Layer storage](#layer-storage)):

- **A `CanNotDelete` lock on the storage account `monbo<env>data`** (not on the
  group). It doesn't block listing the keys or the share's files, so `seed` and
  deploys keep working.
- **Storage Account Backup Contributor on `monbo<env>data`** for the operator: what
  configuring Azure Files backup needs. Then set `share_backup_enabled = true` and
  apply `platform`.

If the `apps` stack is ever destroyed, its pull identity is recreated and loses its
AcrPull: set `registry_admin_enabled = true` again, apply `platform`, then deploy, and
keep it on until the role is re-granted. The order matters both ways: `apps` reads the
setting from `platform`'s state, so `platform` is applied first, and turning the admin
user off before the apps pull by identity leaves a new revision unable to pull.

## Continuous deployment

Merging into `dev` deploys the `dev` environment, and merging into `main` (a release or
a hotfix) deploys `prod`: `.github/workflows/deploy.yml` runs
`infra/deploy.sh <env> --yes`, with the same revision checks and rollback as a manual
deploy. Each environment builds its own images from the pushed commit, in its own
registry.

| A push to `dev` or `main` that changes | Deploys? |
|---|---|
| `apps/**`, `infra/deploy.sh`, `infra/lib.sh`, `infra/terraform/apps/**`, `deploy.yml` | Yes: `dev` from `dev`, `prod` from `main` (if `DEPLOY_PROD` is `true`) |
| Only docs, specs, `infra/terraform/platform/**`, tools | No (`platform` is applied by hand) |

- **`prod` is switched on explicitly.** Runs on `main` deploy only when the repository
  variable `DEPLOY_PROD` is `true` (*Settings → Secrets and variables → Actions →
  Variables*). Otherwise the job is skipped, not failed, so releases can go to `main`
  before production exists, or while it is deployed by hand. Setting it to anything
  else turns production deploys off.
- **One at a time, per environment.** Deploys of an environment queue up
  (`concurrency: deploy-<env>`) and are never cancelled midway; `dev` and `prod` don't
  wait for each other.
- **Failed deploys roll back.** A failed deploy rolls back both apps and fails the run.
  The run's summary says what happened and gives the failed revision's log command.
- **Manual runs.** *Actions → Deploy → Run workflow* on `dev` deploys `dev`, and on
  `main` deploys `prod`. It builds and deploys that commit, or, with a **tag**,
  redeploys images already in that environment's registry, e.g. to go back to an
  earlier version. On any other branch the environment's branch policy refuses it.
- **Dependabot merges deploy too.** The usual caveat applies: a deploy interrupts a
  raster upload being processed (see
  [Deploying while the admin is in use](#deploying-while-the-admin-is-in-use)).

### How CI authenticates

GitHub Actions logs in as the environment's managed identity **`monbo-<env>-deploy`**
(declared in the platform stack, in the environment's group). There is no secret: its
federated credential trusts GitHub's OIDC token only for jobs of `undp/monbo` that run
in the GitHub Environment **`<env>`**, and that environment only allows its branch
(`dev` for `dev`, `main` for `prod`). Pull requests, including forks, can't obtain it,
and `dev`'s jobs can't obtain `prod`'s.

Its only role is **Contributor on its environment's group**, from the administrator
([above](#the-administrators-grants)). It can't assign roles. In `prod` the group is
shared with other UNDP resources, so the identity could change them too: only jobs in
the `prod` GitHub Environment, limited to `main`, can get its token.

### The GitHub Environments `dev` and `prod`

*Settings → Environments → `<env>`*: deployment branches limited to the environment's
branch (`dev` → `dev`, `prod` → `main`), no required reviewers by default (merging is
the approval). A required reviewer on `prod` is an option if releases should wait for
a person before deploying. Each holds its own values for the same secrets:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | `terraform -chdir=infra/terraform/platform output -raw deploy_identity_client_id` (initialized with the environment's backend) |
| `AZURE_TENANT_ID` | `terraform -chdir=infra/terraform/platform output -raw tenant_id` |
| `ARM_SUBSCRIPTION_ID` | as in `infra/envs/<env>.secrets.env` |
| `TF_VAR_RESOURCE_GROUP_NAME` | as in `infra/envs/<env>.secrets.env` (a secret so the public CI logs mask it) |
| `TF_VAR_GCP_MAPS_PLATFORM_API_KEY` | as in `infra/envs/<env>.secrets.env` |
| `TF_VAR_GCP_MAPS_PLATFORM_SIGNATURE_SECRET` | as in `infra/envs/<env>.secrets.env` |
| `TF_VAR_ADMIN_SESSION_SECRET` | as in `infra/envs/<env>.secrets.env` (leave unset to keep the admin off) |
| `TF_VAR_FRONT_GCP_MAPS_PLATFORM_API_KEY` | optional: a separate browser key |

Rotating a secret means updating it here (and in operators' secrets files), then
redeploying the current tag with a manual run.

**Turning it off:** set `DEPLOY_PROD` to `false` (prod only), or disable the workflow
(*Actions → Deploy → Disable workflow*, both environments); `infra/deploy.sh` keeps
working by hand.

## Production

`prod` runs in UNDP's Azure, in another subscription and Entra tenant than `dev`, with
its own state account, registry, layers, identities, GitHub Environment and secrets.
Nothing it uses is shared with `dev`. Operators hold **Contributor on one existing
resource group**, and nothing at subscription scope. Its name, like the subscription
and tenant, is UNDP's and stays out of this public repository: it lives in
`infra/envs/prod.secrets.env` and the `prod` GitHub Environment
(`TF_VAR_resource_group_name`). The same group holds an older, manual Monbo deployment;
the stacks don't touch it, and retiring it is UNDP's decision.

The procedure is [Creating an environment from nothing](#creating-an-environment-from-nothing)
with `prod` (prod's own Maps keys and a new admin secret in
`infra/envs/prod.secrets.env`, never `dev`'s; `az login --tenant <UNDP tenant>`):

1. GitHub Environment `prod`, limited to `main`, no secrets yet.
2. `ARM_SUBSCRIPTION_ID=<prod> ./infra/bootstrap.sh "$TF_VAR_resource_group_name" monboprodtfstate eastus`
   (the group exists, so it only creates the state account).
3. `platform` with `envs/prod.*` (export the key of `monboprodtfstate` first).
4. `tools/layers-ops/layers-ops.sh prod seed`; prod's passkeys go in the password
   manager straight away.
5. `./infra/deploy.sh prod` from a checkout of `main`. `prod` is now live, deployed by
   hand.
6. Ask a UNDP administrator for [the grants](#the-administrators-grants), with both
   principal ids. Then `registry_admin_enabled = false`, apply `platform`, deploy.
7. The `prod` GitHub Environment's secrets, then `DEPLOY_PROD` = `true`. A manual run
   of *Deploy* on `main` (or the next release) must deploy `prod` and show its URLs.

`prod` has been through every step: it deploys from `main` through CI, and since 2.0.1
its apps pull by identity (`registry_admin_enabled = false` in
`platform/envs/prod.tfvars`), so its registry's admin user is off, as in `dev`. After
a deploy or a rollback, `GET /health` on the API reports the version it runs: it reads
the FastAPI app's version, which every release bumps with the version files.

The first release into `main` after the web check rename needs `main`'s ruleset
switched to the new check name right before it merges
([branch_protection.md](branch_protection.md#renaming-a-required-check)).

**Rolling production back, or stopping it:**

- **To the previous release:** a manual run of *Deploy* on `main` with the previous
  tag (the registry `monboprodacr` keeps every tag), or
  `TAG=<tag> ./infra/deploy.sh prod --skip-build`.
- **Stopping automatic deploys:** `DEPLOY_PROD` = `false`. `./infra/deploy.sh prod`
  keeps working by hand.
- Destroying the `apps` stack loses no data; `platform` keeps `prevent_destroy` on the
  storage account and the share.

## Layer storage

The API reads its layers from the `maps` Azure Files share mounted at `/mnt/maps`
(`MAPS_ROOT`), in the per-country layout the layers admin writes to
([maps.md](maps.md#per-country-layout)). The share outlives releases, restarts and new
revisions, and `terraform destroy` of the apps stack. The API image carries no layers
(the Git-tracked `apps/api/app/maps` is only the source the share is seeded from), and
an API that finds no layers at `MAPS_ROOT` refuses to start.

| Resource | Name | Why |
|---|---|---|
| Storage account / share | `monbo<env>data` / `maps` (10 GiB, SMB), in the environment's group | TLS 1.2+, HTTPS only, no public blob access |
| `prevent_destroy` | on the storage account and the share | Destroying them takes a code change, on purpose |
| Share soft delete | 14 days | A deleted share can be undeleted |
| Share snapshots | taken by `seed` before it empties the share, or by hand | Point-in-time copies to restore files from |
| Environment storage | `maps` on the Container Apps environment (apps stack) | What the API's volume refers to |

**What the layers no longer have.** Before both environments moved to one group,
`dev`'s layers had their own group with a `CanNotDelete` lock and a daily Azure
Backup kept 30 days. Both need more than Contributor, so neither environment has them
now:

- nothing but `prevent_destroy` stops someone with access to the group from deleting
  the storage account, and with it every snapshot;
- admin edits and usage events made since the last snapshot can be lost.

The layers in Git can always be seeded again. Ask for the optional grants in
[The administrator's grants](#the-administrators-grants) to get the lock and the
backup back (`share_backup_enabled = true` adds the vault `monbo-<env>-backup` with
policy `maps-daily-30d`, daily at 06:00 UTC, kept 30 days). Until then, take a
snapshot by hand before a risky change:

```sh
AZURE_STORAGE_KEY="$(az storage account keys list -g <group> -n monbo<env>data --query '[0].value' -o tsv)" \
  az storage share snapshot --name maps --account-name monbo<env>data
```

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
jobs, and the usage events and rollups under `usage/`, so the admin's Usage page
starts empty), and uploads the Git-tracked layers again. Every country gets a new passkey.

Before emptying the share, `seed` takes a snapshot of it and prints its timestamp:
that is the one to restore (see [Rollback](#rollback)). `countries.json` is uploaded last, so if the upload dies midway the share
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
- **Restoring files:** from a share snapshot, in the Azure portal (storage account →
  File shares → `maps` → Snapshots) or with `az storage file download --snapshot`.
  A deleted share can be undeleted within 14 days. With `share_backup_enabled`, the
  vault's "Restore" on the `maps` item also works.
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

## Moving dev to one resource group

Until 2026-11, `dev` had four groups (`monbo-tfstate` with `monbotfstate`,
`monbo-dev-data` with a lock and a daily backup, `monbo-dev-platform`,
`monbo-dev-apps`), Terraform-managed roles and an Entra-only state. It is rebuilt from
nothing in the one-group layout. Its layers are only Git's plus test edits, so they are
not migrated: the new share is seeded again, and every country gets a new passkey.

The storage account and registry names are global, so the old `monbodevdata` and
`monbodevacr` must be gone before the new `platform` apply. `dev` is down from step 2
to step 4.

1. **Pause CI:** *Actions → Deploy → Disable workflow*, so a merge into `dev` doesn't
   deploy halfway through.
2. **Remove the old `dev`**, in Inventures' subscription, as an Owner (the lock and
   the roles need it):

   ```sh
   az account set --subscription "$ARM_SUBSCRIPTION_ID"
   # The data group's lock first: it also blocks stopping the backup protection.
   az lock delete -g monbo-dev-data -n monbo-dev-data-no-delete
   # Stop protecting the share and delete its backups (the item's name is internal).
   item=$(az backup item list -g monbo-dev-data -v monbo-dev-backup --backup-management-type AzureStorage \
     --workload-type AzureFileShare --query "[?properties.friendlyName=='maps'].name" -o tsv)
   az backup protection disable -g monbo-dev-data -v monbo-dev-backup \
     --container-name "StorageContainer;Storage;monbo-dev-data;monbodevdata" --item-name "$item" \
     --backup-management-type AzureStorage --workload-type AzureFileShare \
     --delete-backup-data true --yes
   # Azure Backup's own lock on the account doesn't go away by itself: remove it.
   az lock delete -g monbo-dev-data -n AzureBackupProtectionLock \
     --resource monbodevdata --resource-type Microsoft.Storage/storageAccounts
   # The storage account: this frees the global name monbodevdata.
   az storage account delete -g monbo-dev-data -n monbodevdata --yes
   # The deploy identity's Reader on the subscription: the only role outside the groups.
   PRINCIPAL=$(az identity show -g monbo-dev-platform -n monbo-dev-deploy --query principalId -o tsv)
   az role assignment delete --assignee-object-id "$PRINCIPAL" --role Reader --scope "/subscriptions/$ARM_SUBSCRIPTION_ID"
   # The groups (the Container Apps environment takes a while), and the old state. This
   # frees monbodevacr.
   az group delete -n monbo-dev-apps --yes
   az group delete -n monbo-dev-platform --yes
   az group delete -n monbo-tfstate --yes
   ```

   The vault `monbo-dev-backup`, and with it the group `monbo-dev-data`, can't be
   deleted yet. The stopped backup item stays in soft delete for 14 days, and until it
   is purged the vault refuses deletion ("existing resources within the vault") and
   unregistering the account fails with a generic internal error. It holds no data and
   blocks nothing. After the item is purged (for the 2026-11-24 removal, from
   2026-12-08):

   ```sh
   az backup container unregister -g monbo-dev-data -v monbo-dev-backup --backup-management-type AzureStorage \
     --container-name "StorageContainer;Storage;monbo-dev-data;monbodevdata" --yes
   az backup vault delete -g monbo-dev-data -n monbo-dev-backup --yes --force
   az group delete -n monbo-dev-data --yes
   ```

3. **Create the new `dev`** from this branch: [Creating an environment from
   nothing](#creating-an-environment-from-nothing), steps 2 to 6. The GitHub
   Environment `dev` already exists; the federated credential is new, so step 7 only
   replaces its `AZURE_CLIENT_ID` and adds `TF_VAR_RESOURCE_GROUP_NAME` (`monbo-dev`).
4. **Merge** the change into `dev` and enable the workflow again. The merge deploys
   `dev` from CI: the check that the new layout works from GitHub Actions too.

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

**Vault soft delete is always on.** New Recovery Services vaults (the old ones, and
`monbo-<env>-backup` when `share_backup_enabled` creates it) come with soft delete in
`AlwaysON` mode, 14 days, which can't be turned off: backups deleted by mistake can be
recovered for 14 days, even by someone who can delete them. It also means a vault's
deleted backups outlive the vault for 14 days, which is why removing one needs
`--force`.

## Making the Terraform check required

The `CI` workflow's `Terraform` job (fmt, validate, mocked tests) runs on pull
requests that change `infra/`, but is not a required check. To require it, add
`Terraform` to the `required_status_checks` of both rulesets
([branch_protection.md](branch_protection.md#how-to-apply-it)). Because it is skipped
by its own condition when `infra/` doesn't change, requiring it doesn't block other
pull requests.
