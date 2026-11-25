# infra

Everything that builds and deploys Monbo's Azure environment. This page explains how
the Terraform code is organized and how the pieces interact. The step-by-step
procedures (creating an environment, deploying, rolling back, removing the old
environment) are in [docs/suggested_deployment.md](../docs/suggested_deployment.md),
and what each resource does at runtime is in
[docs/architecture.md](../docs/architecture.md).

## The three pieces

There are three parts, each with a different lifecycle:

1. **The environment's resource group and a place for Terraform's state**, one
   storage account per environment (`monbodevtfstate` in `monbo-dev`,
   `monboprodtfstate` in the group UNDP granted), prepared once by `bootstrap.sh`.
2. **Two Terraform stacks per environment**, both in that group:
   - `platform`: what must last (the layers, the registry, the logs, the deploy
     identity);
   - `apps`: what can be thrown away and rebuilt (the Container Apps). A rebuild
     recreates the pull identity, which then needs its AcrPull granted again.
3. **Scripts that use them**:
   - `deploy.sh` deploys;
   - `tools/layers-ops/layers-ops.sh` seeds the share and manages countries.

```
infra/
├── bootstrap.sh                 ① once per environment: its group and where its state lives
├── deploy.sh                    ④ deploy: build → apply apps → verify
├── lib.sh                          helpers shared by deploy.sh and layers-ops.sh
├── envs/
│   ├── dev.secrets.env.example     secrets template (the real dev.secrets.env is git-ignored)
│   └── prod.secrets.env.example    the same for prod
└── terraform/
    ├── platform/                ② long-lived: data, registry, logs, deploy identity
    │   ├── versions.tf             Terraform/azurerm versions, "the state is in Azure"
    │   ├── variables.tf            what can be configured (env, location, group, suffix…)
    │   ├── main.tf                 the resources
    │   ├── deploy.tf               the identity CI deploys as
    │   ├── outputs.tf              what it publishes for the others (names, ids)
    │   ├── envs/dev.tfvars         dev's values (env = "dev", region, group, switches)
    │   ├── envs/dev.backend.hcl    where dev's state is stored
    │   ├── envs/prod.*             the same for prod
    │   ├── tests/platform.tftest.hcl   tests without Azure (mocked provider)
    │   └── .terraform.lock.hcl     exact provider version and hashes
    └── apps/                    ③ recreated on every deploy
        ├── versions.tf
        ├── variables.tf            images, sizes, thresholds (set on the API), secrets
        ├── data.tf                 READS platform's outputs
        ├── main.tf                 Container Apps environment, identity, share registration
        ├── api.tf                  the API Container App
        ├── web.tf                  the frontend Container App
        ├── outputs.tf              API and web URLs, the pull identity
        ├── envs/dev.*, envs/prod.*
        ├── tests/apps.tftest.hcl
        └── .terraform.lock.hcl

tools/layers-ops/
└── layers-ops.sh                ⑤ seed and countries, on the share
```

## Terraform in five minutes

You describe the resources you want. Terraform compares that description with what
exists and creates, changes or deletes only the difference. `terraform plan` shows
that difference without touching anything; `terraform apply` executes it.

Terraform reads **every `.tf` file in a folder as one program**; splitting it into
files is only for readability. Each folder under `terraform/` is one *stack*: it is
planned, applied and stored on its own.

| File | What it is for | Python analogy |
|---|---|---|
| `versions.tf` | Pins Terraform and the azurerm provider, and says the state lives in Azure (`backend "azurerm"`) | `pyproject.toml` |
| `variables.tf` | Declares what can be configured, with types, defaults and validations (e.g. the admin secret must be at least 32 characters) | A function's parameters |
| `main.tf`, `api.tf`, `web.tf` | **Resources**: "this must exist, configured like this" | The function body |
| `data.tf` | **Reads** things that already exist, without creating them (the group, platform's outputs, the storage key) | An `import` |
| `outputs.tf` | What the stack publishes when it finishes | The `return` |
| `envs/<env>.tfvars` | The variables' **values** for one environment | The arguments you call it with |
| `envs/<env>.backend.hcl` | Which blob holds **this** environment's state (`dev/platform.tfstate`) | — |
| `.terraform.lock.hcl` | The exact provider version and hashes; committed | `uv.lock` |
| `tests/*.tftest.hcl` | Tests that run the stack against a **mocked** Azure | pytest |

**The state** (`*.tfstate`) is Terraform's memory: which resources it created and
how they are. That is how the next apply knows what to change. It must not live on
a laptop (others need it, and it contains secrets), so it lives in a dedicated
storage account that `bootstrap.sh` creates, which keeps earlier versions of every
state. It is read with the account's key, because the operators may only hold
Contributor, which can't grant a data role on the account: `lib.sh` fetches the key
with the current Azure login and exports it as `ARM_ACCESS_KEY` before every
`terraform init`.

## How the pieces interact

The diagram shows `dev`. `prod` is the same with `prod` in every name, in the group
UNDP granted
([One resource group per environment](#one-resource-group-per-environment)).

```
 Azure resource group monbo-dev (prod: the group UNDP granted)
            ┌──────────────── state account monbodevtfstate ──────────────────────┐
            │   blob dev/platform.tfstate              blob dev/apps.tfstate      │
            └──────▲─────────────────────┬────────────────────▲──────────────────┘
                   │ stores              │ reads outputs      │ stores
 ① bootstrap.sh ───┘ (creates the group, │ if missing, and    │
                      the account)       │                    │
 ② platform (applied by hand) ───────────┘                    │
    reads:   the group (never changes it)
    creates: storage monbodevdata, share maps, registry monbodevacr,
             Log Analytics, identity monbo-dev-deploy + GitHub federated credential
    publishes (outputs): the group, storage and share names, registry id and
                         login server, Log Analytics id…
                                                              │
 ③ apps ── data.tf reads those outputs ───────────────────────┘
    creates: environment monbo-dev-env (logs → Log Analytics)
             identity monbo-dev-pull (AcrPull: granted by an administrator)
             the share registered on the environment ("maps")
             monbo-api   (mounts the share at /mnt/maps)
             monbo-front (NEXT_PUBLIC_API_URL = the API's URL)
```

- **The link is `apps/data.tf`.** `apps` doesn't repeat names: it asks `platform`'s
  state which registry, storage account and log workspace to use. A change in
  `platform` (a suffix, a new account) reaches `apps` on its next apply.
- **Why two stacks:**
  - `apps` is applied on every deploy and can be destroyed without losing anything;
  - `platform` holds the layers, rarely changes, and its storage account and share
    carry `prevent_destroy`, so Terraform refuses to delete them even if asked;
  - and the images must be in the registry (`platform`) before the apps that use
    them can be created (`apps`).
- **Why the apps' URLs don't depend on each other:** both are computed from the
  environment's domain (`https://<name>.<default_domain>`). The API knows the web
  app's URL (for `ADMIN_ALLOWED_ORIGIN`), and the web app knows the API's
  (`NEXT_PUBLIC_API_URL`), without either waiting for the other.

## The full flow, and who runs what

```
Once:    ARM_SUBSCRIPTION_ID=… infra/bootstrap.sh monbo-dev monbodevtfstate eastus
                                                                 → the group (if missing), the state account
Once:    terraform apply in platform (with envs/dev.tfvars)       → empty share, registry, logs, deploy identity
Once:    tools/layers-ops/layers-ops.sh dev seed                  → uploads the Git layers to the share
                                                                   (prints 3 passkeys)
Once:    an administrator grants Contributor (deploy identity) and AcrPull (pull identity)
Always:  infra/deploy.sh dev    (on every merge into dev, by .github/workflows/deploy.yml;
                                 also by hand; prod: on every merge into main, once
                                 DEPLOY_PROD is on)
           1. loads infra/envs/dev.secrets.env (subscription + TF_VAR_*), exports
              the state account's key
           2. reads platform's outputs (which registry? which share?)
           3. does the share have countries.json? if not, stops
           4. docker build + push to monbodevacr, tagged with the commit
           5. notes the images serving now (each app's latest ready revision)
           6. terraform apply in apps with api_image / web_image
           7. waits until each app's new revision is ready with the new image,
              then checks /health → mapsRoot=/mnt/maps, writable, and the web app
           8. if 6 or 7 fails: applies the images from step 5 again (both apps)
              and exits with an error and the failed revision's log command
```

**Why a deploy never stays half-done.** Container Apps (single revision mode) keeps the
previous revision serving until the new one passes its startup probe, so users never
reach a failed revision. What could be left half-done is Terraform's view: the apply
succeeds and records the new image even if its revision never becomes ready, or the
API updates and the frontend doesn't. Step 7 detects that (a plain `/health` check
would be answered by the old revision) and step 8 applies the last healthy images
again, so both apps and the state agree. Terraform itself has no transactional
rollback, and neither do Terraform Stacks or Azure Deployment Stacks; see "Considered
and not adopted" below.

`lib.sh` holds what `deploy.sh` and `layers-ops.sh` share:

- loading the secrets;
- initializing a stack with its backend file, after exporting the state key;
- reading platform's outputs;
- selecting the subscription;
- checking the share for `countries.json`.

`deploy.sh` never applies `platform`: that plan is read by a person before it runs.

**In CI** (`.github/workflows/deploy.yml`), the same script runs as the managed
identity `monbo-<env>-deploy`, declared in `platform/deploy.tf`: a push to `dev` deploys
`dev`, a push to `main` deploys `prod` (when the repository variable `DEPLOY_PROD` is
`true`). GitHub's OIDC token is exchanged for it, so nothing secret is stored for
Azure, and only jobs in the GitHub Environment `<env>` (restricted to its branch:
`dev` → `dev`, `prod` → `main`) can obtain it. Its only role is Contributor on its
environment's group, granted once by an administrator; see
[suggested_deployment.md](../docs/suggested_deployment.md#the-administrators-grants).

## One resource group per environment

Production runs in the one existing group UNDP granted, where the operators only hold
Contributor: they can't create groups, assign roles or create locks. `dev` is prod's
test environment, so it has the same layout in its own group: what `dev` deploys is
what `prod` runs. So neither stack creates a resource group, a lock or a role
assignment:

| `platform` variable | `dev` | `prod` | What it does |
|---|---|---|---|
| `resource_group_name` | `monbo-dev` | the group UNDP granted | Every resource goes in that group, in `location`. Read only: never modified or locked. Set as `TF_VAR_resource_group_name` in `infra/envs/<env>.secrets.env` and the GitHub Environment, never committed (prod's is UNDP's) |
| `registry_admin_enabled` | `true` | `true` | The apps pull with the registry's admin user. Set to `false` once the pull identity holds AcrPull |
| `share_backup_enabled` | `false` | `false` | The daily Azure Backup. Needs more than Contributor to configure |

An administrator grants the roles once: Contributor on the group to the deploy
identity (for CI) and AcrPull on the registry to the pull identity. What the layers
lose without the lock and the backup, and the grants that bring them back, are in
[suggested_deployment.md](../docs/suggested_deployment.md#layer-storage).

## Considered and not adopted

- **Terraform Stacks** (`.tfcomponent.hcl` / `.tfdeploy.hcl`). Stacks are an HCP
  Terraform feature: plans and applies run in HCP Terraform, which also holds the
  state, connected to GitHub, with OIDC credentials. They orchestrate components and
  several deployments (environments) of the same configuration. They don't roll back a
  failed apply. Adopting them would move the state out of Azure into a SaaS account,
  for an orchestration that two stacks and a remote-state link already cover with one
  environment. Reconsider if Monbo grows to several environments or regions and the
  team adopts HCP Terraform.
- **Azure Deployment Stacks** (`az stack`). They are Bicep/ARM-only (adopting them
  means rewriting the Terraform) and have no rollback either: a failed stack
  deployment stays failed with what it created. What they add, deny assignments
  against portal changes and cleanup of resources removed from the template, is
  covered here by `prevent_destroy` and Terraform's own drift detection.
  ARM's `--rollback-on-error` exists only for plain ARM deployments.

## Where each value goes

| Value | File | In Git? |
|---|---|---|
| Environment name, region, optional suffix, the registry admin and backup switches | `terraform/platform/envs/<env>.tfvars` | Yes |
| Sizes, thresholds (go to the API, which publishes them at `GET /config`), testing banner, contact URL | `terraform/apps/envs/<env>.tfvars` | Yes |
| Where the state is (account, key) | `terraform/*/envs/<env>.backend.hcl`, and `state_storage_account_name` in `apps/envs/<env>.tfvars` | Yes |
| Subscription (`ARM_SUBSCRIPTION_ID`), resource group (`TF_VAR_resource_group_name`), Maps keys, admin secret (`TF_VAR_*`) | `infra/envs/<env>.secrets.env` locally; the GitHub Environment `<env>` in CI | **No** |
| CI's Azure login (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`) | The GitHub Environment (values from `platform`'s outputs) | **No** |
| The images to deploy | Passed by `deploy.sh` on every run (`-var api_image=…`) | n/a |

The secrets reach the apps only as Container App secrets. They also end up in the
Terraform state: anyone who can list the state account's keys can read them.

## Names

Resources are named `monbo-<env>-…`: `monbo-dev-env`, `monbo-dev-logs`,
`monbo-dev-deploy`, `monbo-dev-pull`… The group is `monbo-dev` for `dev` and the one
UNDP granted for `prod`. Three names can't follow that pattern. Azure only allows
lowercase letters and digits in storage account and registry names, and they are
unique across all of Azure (they become `monbodevdata.file.core.windows.net` and
`monbodevacr.azurecr.io`). They are `monbo<env>data`, `monbo<env>tfstate` and
`monbo<env>acr`. If the data account or the registry is ever taken, for example by a
fork deployed to another organization's subscription, set `unique_suffix` in
`platform/envs/<env>.tfvars`; it changes only those two names.

## Adding an environment

`dev` and `prod` exist. A new environment `<env>` needs:

- a resource group, and a state account in it (`bootstrap.sh` creates both, or only
  the account in a group that already exists);
- `envs/<env>.tfvars` and `envs/<env>.backend.hcl` in both stacks (state keys
  `<env>/platform.tfstate`, `<env>/apps.tfstate`), naming its state account (no
  default, so no environment points at another's);
- an `infra/envs/<env>.secrets.env` with the subscription, the group
  (`TF_VAR_resource_group_name`) and the secrets.

Then apply `platform`, seed, deploy, and ask for the two grants, as in
[suggested_deployment.md](../docs/suggested_deployment.md#creating-an-environment-from-nothing).
The code doesn't change, and `dev` is unaffected: each environment has its own
resources and its own state.

## Working on the Terraform code

```sh
cd infra/terraform/apps                      # or platform
terraform fmt -recursive ..                  # format
terraform init -backend=false                # no Azure needed for the next two
terraform validate
terraform test                               # runs tests/*.tftest.hcl against a mocked provider
```

The tests check that the stacks deploy what Monbo needs:

- **apps:** everything in the platform's group and region, the probes, the share
  mounted for uid 10001 at `/mnt/maps`, one API replica, image pulls by identity (or by
  the registry's admin user while it is on), the admin turned on and off by its
  secret, the seven `NEXT_PUBLIC_*` variables;
- **platform:** everything in the one group and in the environment's region, TLS 1.2,
  soft delete, the optional backup, the registry's admin user switch, the federated
  credential, the names.

The `Terraform` job of the CI workflow runs the same commands on every pull request
that changes `infra/`.

To see what a change would do in Azure, run a real plan with the backend:

```sh
set -a; source infra/envs/dev.secrets.env; set +a   # subscription and secrets
export ARM_ACCESS_KEY="$(az storage account keys list -g "$TF_VAR_resource_group_name" -n monbodevtfstate --query '[0].value' -o tsv)"
cd infra/terraform/apps
terraform init -backend-config=envs/dev.backend.hcl -backend-config="resource_group_name=$TF_VAR_resource_group_name"
terraform plan -var-file=envs/dev.tfvars \
  -var api_image=<registry>/monbo-api:<tag> -var web_image=<registry>/monbo-front:<tag>
```

**Rules of thumb:**

- Change the apps' settings in `apps/*.tf` or `envs/<env>.tfvars`, never in the
  portal: a portal change shows up in the next plan and is reverted by the next
  deploy.
- A new `NEXT_PUBLIC_*` variable needs an `env` block in `apps/web.tf`, plus
  `config/env.ts`, `entrypoint.sh` and the `.env.*.example` files in `apps/web`.
- With `share_backup_enabled`, the backup vault has Azure's always-on soft delete:
  deleted backups are recoverable for 14 days and can't be purged sooner.
- Read every `platform` plan before applying it. A line with `destroy` or
  `replace` on the storage account, the share or the vault means stop: those hold
  the layers (and `prevent_destroy` will refuse anyway).
- Provider bumps arrive from Dependabot and move both stacks together. A new azurerm
  major is a migration: read its upgrade guide.
