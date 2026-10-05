# infra

Everything that builds and deploys Monbo's Azure environment. This page explains how
the Terraform code is organized and how the pieces interact. The step-by-step
procedures (creating an environment, deploying, rolling back, removing the old
environment) are in [docs/suggested_deployment.md](../docs/suggested_deployment.md),
and what each resource does at runtime is in
[docs/architecture.md](../docs/architecture.md).

## The three pieces

There are three parts, each with a different lifecycle:

1. **A place for Terraform's state**, created once per subscription by
   `bootstrap.sh`.
2. **Two Terraform stacks per environment**:
   - `platform`: what must last (the layers, their backups, the registry, the logs);
   - `apps`: what can be thrown away and rebuilt (the Container Apps).
3. **Scripts that use them**:
   - `deploy.sh` deploys;
   - `tools/layers-ops/layers-ops.sh` seeds the share and manages countries.

```
infra/
├── bootstrap.sh                 ① once per subscription: where the state lives
├── deploy.sh                    ④ deploy: build → apply apps → verify
├── lib.sh                          helpers shared by deploy.sh and layers-ops.sh
├── envs/
│   └── dev.secrets.env.example     secrets template (the real dev.secrets.env is git-ignored)
└── terraform/
    ├── platform/                ② long-lived: data, registry, logs
    │   ├── versions.tf             Terraform/azurerm versions, "the state is in Azure"
    │   ├── variables.tf            what can be configured (env, location, suffix…)
    │   ├── main.tf                 the resources
    │   ├── outputs.tf              what it publishes for the others (names, ids)
    │   ├── envs/dev.tfvars         dev's values (env = "dev", region)
    │   ├── envs/dev.backend.hcl    where dev's state is stored
    │   ├── tests/platform.tftest.hcl   tests without Azure (mocked provider)
    │   └── .terraform.lock.hcl     exact provider version and hashes
    └── apps/                    ③ recreated on every deploy
        ├── versions.tf
        ├── variables.tf            images, sizes, thresholds, secrets
        ├── data.tf                 READS platform's outputs
        ├── main.tf                 Container Apps environment, identity, share registration
        ├── api.tf                  the API Container App
        ├── web.tf                  the frontend Container App
        ├── outputs.tf              API and web URLs
        ├── envs/dev.tfvars, envs/dev.backend.hcl
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
| `data.tf` | **Reads** things that already exist, without creating them (platform's outputs, the storage key) | An `import` |
| `outputs.tf` | What the stack publishes when it finishes | The `return` |
| `envs/<env>.tfvars` | The variables' **values** for one environment | The arguments you call it with |
| `envs/<env>.backend.hcl` | Which blob holds **this** environment's state (`dev/platform.tfstate`) | — |
| `.terraform.lock.hcl` | The exact provider version and hashes; committed | `uv.lock` |
| `tests/*.tftest.hcl` | Tests that run the stack against a **mocked** Azure | pytest |

**The state** (`*.tfstate`) is Terraform's memory: which resources it created and
how they are. That is how the next apply knows what to change. It must not live on
a laptop (others need it, and it contains secrets), so it lives in a dedicated
storage account that `bootstrap.sh` creates. That account accepts only Entra ID
access, with shared keys disabled, and keeps earlier versions of every state.

## How the pieces interact

```
            ┌──────────────── Azure: monbo-tfstate / monbotfstate ────────────────┐
            │   blob dev/platform.tfstate              blob dev/apps.tfstate      │
            └──────▲─────────────────────┬────────────────────▲──────────────────┘
                   │ stores              │ reads outputs      │ stores
 ① bootstrap.sh ───┘ (creates the account)                    │
                                         │                    │
 ② platform (applied by hand) ───────────┘                    │
    creates: monbo-dev-data     → storage monbodevdata, share maps,
                                  backup vault + policy, CanNotDelete lock
             monbo-dev-platform → registry monbodevacr, Log Analytics
    publishes (outputs): storage and share names, registry id and
                         login server, Log Analytics id…
                                                              │
 ③ apps ── data.tf reads those outputs ───────────────────────┘
    creates: monbo-dev-apps → environment monbo-dev-env (logs → Log Analytics)
                              identity monbo-dev-pull + AcrPull on the registry
                              the share registered on the environment ("maps")
                              monbo-api   (mounts the share at /mnt/maps)
                              monbo-front (NEXT_PUBLIC_API_URL = the API's URL)
```

- **The link is `apps/data.tf`.** `apps` doesn't repeat names: it asks `platform`'s
  state which registry, storage account and log workspace to use. A change in
  `platform` (a suffix, a new account) reaches `apps` on its next apply.
- **Why two stacks:**
  - `apps` is applied on every deploy and can be destroyed without losing anything;
  - `platform` holds the layers, rarely changes, and its storage account, share and
    backups carry `prevent_destroy`, so Terraform refuses to delete them even if
    asked;
  - and the images must be in the registry (`platform`) before the apps that use
    them can be created (`apps`).
- **Why the apps' URLs don't depend on each other:** both are computed from the
  environment's domain (`https://<name>.<default_domain>`). The API knows the web
  app's URL (for `ADMIN_ALLOWED_ORIGIN`), and the web app knows the API's
  (`NEXT_PUBLIC_API_URL`), without either waiting for the other.

## The full flow, and who runs what

```
Once:    ARM_SUBSCRIPTION_ID=… infra/bootstrap.sh                → creates monbotfstate
Once:    terraform apply in platform (with envs/dev.tfvars)       → empty share, registry, logs
Once:    tools/layers-ops/layers-ops.sh dev seed                  → uploads the Git layers to the share
                                                                   (prints 3 passkeys)
Always:  infra/deploy.sh dev
           1. loads infra/envs/dev.secrets.env (subscription + TF_VAR_*)
           2. reads platform's outputs (which registry? which share?)
           3. does the share have countries.json? if not, stops
           4. docker build + push to monbodevacr, tagged with the commit
           5. terraform apply in apps with api_image / web_image
           6. checks /health → mapsRoot=/mnt/maps, writable
```

`lib.sh` holds what `deploy.sh` and `layers-ops.sh` share:

- loading the secrets;
- initializing a stack with its backend file;
- reading platform's outputs;
- selecting the subscription;
- checking the share for `countries.json`.

`deploy.sh` never applies `platform`: that plan is read by a person before it runs.

## Where each value goes

| Value | File | In Git? |
|---|---|---|
| Environment name, region, optional suffix | `terraform/platform/envs/<env>.tfvars` | Yes |
| Sizes, thresholds, testing banner, contact URL | `terraform/apps/envs/<env>.tfvars` | Yes |
| Where the state is | `terraform/*/envs/<env>.backend.hcl` | Yes |
| Subscription (`ARM_SUBSCRIPTION_ID`), Maps keys, admin secret (`TF_VAR_*`) | `infra/envs/<env>.secrets.env` locally; GitHub Environment in CI | **No** |
| The images to deploy | Passed by `deploy.sh` on every run (`-var api_image=…`) | n/a |

The secrets reach the apps only as Container App secrets. They also end up in the
Terraform state, which is why the state account is Entra-only.

## Names

Resources are named `monbo-<env>-…`: `monbo-dev-data`, `monbo-dev-apps`,
`monbo-dev-backup`, `monbo-dev-env`… Two names can't follow that pattern. Azure only
allows lowercase letters and digits in storage account and registry names, and they
are unique across all of Azure (they become `monbodevdata.file.core.windows.net` and
`monbodevacr.azurecr.io`). They are `monbo<env>data` and `monbo<env>acr`. If one is
ever taken, for example by a fork deployed to another organization's subscription,
set `unique_suffix` in `platform/envs/<env>.tfvars`; it changes only those two names.

## Adding an environment

Add the files for the new environment (e.g. `prod`):

- `envs/prod.tfvars` and `envs/prod.backend.hcl` in both stacks (state keys
  `prod/platform.tfstate`, `prod/apps.tfstate`);
- an `infra/envs/prod.secrets.env`.

Then apply `platform`, seed, and deploy, as in
[suggested_deployment.md](../docs/suggested_deployment.md#creating-an-environment-from-nothing).
The code doesn't change, and `dev` is unaffected: each environment has its own
resource groups and its own state.

## Working on the Terraform code

```sh
cd infra/terraform/apps                      # or platform
terraform fmt -recursive ..                  # format
terraform init -backend=false                # no Azure needed for the next two
terraform validate
terraform test                               # runs tests/*.tftest.hcl against a mocked provider
```

The tests check that the stacks deploy what Monbo needs:

- **apps:** the probes, the share mounted for uid 10001 at `/mnt/maps`, one API
  replica, image pulls by identity with no password, the admin turned on and off by
  its secret, the seven `NEXT_PUBLIC_*` variables;
- **platform:** the lock, the backups, TLS 1.2, the registry's admin user off, the
  names.

The `Terraform` job of the CI workflow runs the same commands on every pull request
that changes `infra/`.

To see what a change would do in Azure, run a real plan with the backend:

```sh
set -a; source infra/envs/dev.secrets.env; set +a   # subscription and secrets
cd infra/terraform/apps
terraform init -backend-config=envs/dev.backend.hcl
terraform plan -var-file=envs/dev.tfvars \
  -var api_image=<registry>/monbo-api:<tag> -var web_image=<registry>/monbo-front:<tag>
```

**Rules of thumb:**

- Change the apps' settings in `apps/*.tf` or `envs/<env>.tfvars`, never in the
  portal: a portal change shows up in the next plan and is reverted by the next
  deploy.
- A new `NEXT_PUBLIC_*` variable needs an `env` block in `apps/web.tf`, plus
  `config/env.ts`, `entrypoint.sh` and the `.env.*.example` files in `apps/web`.
- The backup vault has Azure's always-on soft delete: deleted backups are recoverable
  for 14 days and can't be purged sooner.
- Read every `platform` plan before applying it. A line with `destroy` or
  `replace` on the storage account, the share or the vault means stop: those hold
  the layers (and `prevent_destroy` will refuse anyway).
- Provider bumps arrive from Dependabot and move both stacks together. A new azurerm
  major is a migration: read its upgrade guide.
