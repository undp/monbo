# Suggested deployment (Azure Container Apps, Terraform)

The Azure environment is declared in Terraform under `infra/terraform/`, in two
stacks per environment. How the Terraform code is organized and how its pieces
interact is in [infra/README.md](../infra/README.md); what each resource does is in
[architecture.md](architecture.md).

| Stack | Holds | Applied |
|---|---|---|
| `platform` | The layers: data resource group with a delete lock, storage account and `maps` share, backups. Plus the container registry and the Log Analytics workspace | By hand, after reading its plan. Rarely changes |
| `apps` | The Container Apps environment, the pull identity, the API and web apps | By `infra/deploy.sh` on every deploy. Can be destroyed: the layers stay |

There are two environments: `dev`, deployed from the `dev` branch, and `prod`, deployed
from `main` once it is set up ([Production](#production)). Each is a pair of files per
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

Once per state account (each environment has its own: `monbotfstate` for `dev`,
`monboprodtfstate` for `prod`, each in its environment's subscription):

1. **State account.** `ARM_SUBSCRIPTION_ID=<id> ./infra/bootstrap.sh [account]`
   creates the resource group `monbo-tfstate` with the storage account (default
   `monbotfstate`; shared keys disabled, versioning and soft delete), and gives you
   `Storage Blob Data Contributor` on it. The environment names its account in
   `envs/<env>.backend.hcl` and in `state_storage_account_name` of
   `envs/<env>.tfvars`, in both stacks. Grant the same role to other operators.

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

**Adding an environment** is new `envs/<env>.tfvars` and `envs/<env>.backend.hcl`
files in both stacks (state keys `<env>/platform.tfstate`, `<env>/apps.tfstate`) and
an `infra/envs/<env>.secrets.env`, then steps 1–4. `prod`'s files already exist; its
full procedure, including CI, is in [Production](#production).

**Global names.** The storage account and the registry are named `monbo<env>data` and
`monbo<env>acr`: Azure only allows lowercase letters and digits in them, and they are
unique across all of Azure. If one is ever taken (for example a fork deployed to
another organization's subscription), set `unique_suffix` in `platform/envs/<env>.tfvars`;
it only changes those two names.

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
  before production exists. Setting it to anything else turns production deploys off.
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
- **Rebuilding the apps stack is manual.** CI can update the existing stack, but its
  identity cannot create the `AcrPull` role assignment on the registry. If the
  stack or pull identity is replaced, an operator with role-assignment permission
  runs `infra/deploy.sh <env>` locally to recreate it.

### How CI authenticates

GitHub Actions logs in as the environment's managed identity **`monbo-<env>-deploy`**
(resource group `monbo-<env>-platform`, declared in the platform stack). There is no
secret: its federated credential trusts GitHub's OIDC token only for jobs of
`undp/monbo` that run in the GitHub Environment **`<env>`**, and that environment only
allows its branch (`dev` for `dev`, `main` for `prod`). Pull requests, including
forks, can't obtain it, and `dev`'s jobs can't obtain `prod`'s.

Its roles (names for `dev`; `prod`'s replace `dev` with `prod`):

| Role | Scope | Granted by |
|---|---|---|
| Reader | the environment's subscription | Terraform (`platform`) |
| AcrPush | `monbodevacr` | Terraform |
| Storage Blob Data Contributor | `monbotfstate` (the environment's Terraform state) | Terraform |
| **Contributor** | **`monbo-dev-apps`** | **By hand, by an unconditional Owner** |
| **Storage Account Key Operator Service Role** | **`monbodevdata`** | **By hand, by an unconditional Owner** |

Operators may not be allowed to grant the last two: in the subscription this was set
up in, their Owner role carries an ABAC condition that only lets them assign Reader,
Storage Blob Data *, AcrPull, AcrPush and AcrDelete. In that case a subscription Owner
without that condition grants them once, after the platform stack has created the
identity:

```sh
ENV=dev   # or prod
az account set --subscription "$ARM_SUBSCRIPTION_ID"   # the environment's subscription
PRINCIPAL=$(az identity show -g "monbo-$ENV-platform" -n "monbo-$ENV-deploy" --query principalId -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Contributor" --scope "$(az group show -n "monbo-$ENV-apps" --query id -o tsv)"
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Storage Account Key Operator Service Role" \
  --scope "$(az storage account show -g "monbo-$ENV-data" -n "monbo${ENV}data" --query id -o tsv)"
# Check: five roles
az role assignment list --assignee "$PRINCIPAL" --all --query "[].{role:roleDefinitionName, scope:scope}" -o table
```

Without them, a deploy fails with an authorization error (on `listKeys` or on the
apps resource group) before changing any app.

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
| `TF_VAR_GCP_MAPS_PLATFORM_API_KEY` | as in `infra/envs/<env>.secrets.env` |
| `TF_VAR_GCP_MAPS_PLATFORM_SIGNATURE_SECRET` | as in `infra/envs/<env>.secrets.env` |
| `TF_VAR_ADMIN_SESSION_SECRET` | as in `infra/envs/<env>.secrets.env` (leave unset to keep the admin off) |
| `TF_VAR_FRONT_GCP_MAPS_PLATFORM_API_KEY` | optional: a separate browser key |

Rotating a secret means updating it here (and in operators' secrets files), then
redeploying the current tag with a manual run.

### Setting it up for an environment

1. Create the GitHub Environment with its branch policy, before the federated
   credential that trusts it exists.
2. Apply the platform stack: it creates the identity, its federated credential and
   the three Terraform-managed roles.
3. An unconditional Owner grants the two manual roles (above).
4. Add the environment's secrets.
5. Merge, or run the workflow by hand. Check the run's summary and the environment's
   URL in GitHub.

For `prod`, follow [Production](#production), which also sets `DEPLOY_PROD`.

**Turning it off:** set `DEPLOY_PROD` to `false` (prod only), or disable the workflow
(*Actions → Deploy → Disable workflow*, both environments); `infra/deploy.sh` keeps
working by hand.

## Production

`prod` runs in its own subscription (UNDP's Azure), possibly in another Entra tenant,
with its own state account, registry, layers, deploy identity, GitHub Environment and
secrets. Nothing it uses is shared with `dev`, and nothing account-specific is in the
repository: the subscription and tenant come from `infra/envs/prod.secrets.env` and the
GitHub Environment `prod`.

### What the Azure access must allow

Ask for these before the first apply; each one, if missing, stops the procedure below.

- **Subscription scope.** Terraform creates the resource groups (`monbo-tfstate`,
  `monbo-prod-data`, `monbo-prod-platform`, `monbo-prod-apps`) and gives the deploy
  identity Reader on the subscription. Access limited to pre-created resource groups
  needs a change to the stacks.
- **Creating resources:** Contributor (or Owner) on the subscription, for the
  operators' accounts in the subscription's tenant.
- **Assigning roles.** The operators must be able to assign Reader, AcrPush, AcrPull,
  Storage Blob Data Contributor, Contributor and Storage Account Key Operator Service
  Role: Owner without an ABAC condition, or Role Based Access Control Administrator
  limited to those six. Otherwise someone who can must grant the two manual roles
  (above) and run the first deploy, which creates the pull identity's AcrPull.
- **Resource providers registered:** `Microsoft.App`, `Microsoft.ContainerRegistry`,
  `Microsoft.Storage`, `Microsoft.OperationalInsights`, `Microsoft.RecoveryServices`,
  `Microsoft.ManagedIdentity`.
- **Azure Policy.** Ask for the assignments that apply. These block Monbo as it is:
  - storage accounts without shared-key access (the Container Apps environment mounts
    the share with the account key, and the scripts call `listKeys`);
  - denying public network access on storage, the registry or Container Apps;
  - allowed regions (`location` in `platform/envs/prod.tfvars`, `eastus2` by default);
  - required tags;
  - blocking federated credentials on managed identities (CI logs in with
    `repo:undp/monbo:environment:prod`).

### Setting it up

With access granted, `infra/envs/prod.secrets.env` filled in (prod's own Maps keys and
a new admin secret; never `dev`'s) and `az login` into prod's tenant:

1. **GitHub Environment `prod`**, deployment branches limited to `main`, no secrets yet.
   It must exist with that policy before step 3 creates the credential that trusts it.
2. **State account:** `ARM_SUBSCRIPTION_ID=<prod> ./infra/bootstrap.sh monboprodtfstate`.
3. **Platform:**

   ```sh
   set -a; source infra/envs/prod.secrets.env; set +a
   cd infra/terraform/platform
   terraform init -reconfigure -backend-config=envs/prod.backend.hcl
   terraform plan -var-file=envs/prod.tfvars -out=prod.tfplan   # read it
   terraform apply prod.tfplan
   ```

4. **The two manual roles,** by an Owner allowed to grant them
   ([How CI authenticates](#how-ci-authenticates), `ENV=prod`).
5. **Seed:** `tools/layers-ops/layers-ops.sh prod seed`. Put the printed country
   passkeys in the password manager straight away; they are prod's, not `dev`'s.
6. **First deploy, by hand:** `./infra/deploy.sh prod`. It creates the pull identity's
   AcrPull, which CI can't.
7. **Secrets** of the GitHub Environment `prod` ([table above](#the-github-environments-dev-and-prod)),
   with the client and tenant ids from step 3's outputs.
8. **Switch it on:** repository variable `DEPLOY_PROD` = `true`.
9. **Check:** a manual run of *Deploy* on `main` (or the next release) deploys `prod`
   and its summary shows `prod`'s URLs.

The first release into `main` after the web check rename needs `main`'s ruleset
switched to the new check name right before it merges
([branch_protection.md](branch_protection.md#renaming-a-required-check)).

### Rolling production back, or stopping it

- **To the previous release:** a manual run of *Deploy* on `main` with the previous
  tag (the commit `prod` served before; the registry `monboprodacr` keeps every
  tag).
- **Stopping automatic deploys:** `DEPLOY_PROD` = `false`. `./infra/deploy.sh prod`
  keeps working by hand.
- Destroying the `apps` stack loses no data; `platform` keeps its lock and
  `prevent_destroy` on the layers.

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
