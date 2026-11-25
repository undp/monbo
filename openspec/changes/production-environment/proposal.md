## Why

Monbo has one environment, `dev`, deployed on every merge into `dev`. `main` holds the releases, but nothing deploys them: there is no production environment. Production will run in a subscription of UNDP's own Azure, separate from the one `dev` runs in, and access to it is being requested now. Preparing the repository first means that, once access is granted, standing up production is a procedure to follow, not a change to design.

The Terraform code was written to be parametrized by environment, so most of this is configuration. Three things still assume `dev`:

- the deploy workflow, which deploys only `dev`;
- the Terraform state account `monbotfstate`, a globally unique name that can't be reused in a second subscription;
- the docs and specs, which say this cycle creates only `dev`.

## What Changes

- **A `prod` environment in both Terraform stacks.** `envs/prod.tfvars` and `envs/prod.backend.hcl` in `platform` and `apps`, plus `infra/envs/prod.secrets.env.example`. Resource names follow the existing pattern: `monbo-prod-*`, `monboproddata`, `monboprodacr`. `prod` hides the testing-environment banner.
- **One Terraform state account per environment.** `prod` keeps its state in its own account, `monboprodtfstate`, created with `infra/bootstrap.sh` in prod's subscription. `dev` keeps `monbotfstate`. The state account becomes per-environment configuration in the tfvars and backend files, and the deploy identity of each environment only gets access to its own state.
- **Merging into `main` deploys `prod`.** `.github/workflows/deploy.yml` also runs on pushes to `main`, with the same path filter. The branch selects the environment: `dev` → `dev`, `main` → `prod`. The GitHub Environment, `ENV_NAME` and the concurrency group follow it. Manual runs deploy the environment of the branch they run on.
- **Production deploys are switched on explicitly.** Until a repository variable `DEPLOY_PROD` is `true`, pushes to `main` skip the deploy job. This way releases can go to `main` while production doesn't exist yet, without failed runs.
- **A GitHub Environment `prod`, restricted to `main`.** It holds prod's secrets, the same names as `dev`'s. It must exist, with its branch policy, before the federated credential that trusts it.
- **Docs.** `docs/suggested_deployment.md` and `infra/README.md` gain the production procedure, in order:
  1. the GitHub Environment;
  2. the state account;
  3. `platform`;
  4. the two Owner-granted roles;
  5. the seed;
  6. the first deploy, run by hand;
  7. the secrets;
  8. `DEPLOY_PROD`;
  9. the first release.

  They also list what the Azure access must allow.
- **Out of scope:**
  - a custom domain for production;
  - requesting the Azure access itself;
  - promoting `dev`'s images instead of building on `main` (the registries are in different subscriptions);
  - required reviewers on the `prod` environment (a repository setting, documented as an option).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `continuous-deployment`: merging into `main` deploys `prod`, behind the `DEPLOY_PROD` switch; manual runs deploy the environment of their branch; a second GitHub Environment, `prod`, restricted to `main`; the deploy identity's state access is limited to its environment's state account.
- `infrastructure-as-code`: two environments, `dev` from `dev` and `prod` from `main`; the Terraform state account is per environment, so environments can live in different subscriptions; the rebuild procedure runs `bootstrap.sh` once per state account.

## Impact

- **Terraform:**
  - new `envs/prod.tfvars` and `envs/prod.backend.hcl` in `infra/terraform/platform` and `infra/terraform/apps`;
  - `state_storage_account_name` set explicitly in every environment's tfvars;
  - tests: a `prod` run in `platform.tftest.hcl` (names, federated subject, state scope).
- **Scripts:** `infra/envs/prod.secrets.env.example`. `deploy.sh`, `lib.sh`, `bootstrap.sh` and `layers-ops.sh` already take the environment as an argument; at most messages and comments change.
- **Workflow:** `.github/workflows/deploy.yml` (triggers, environment selection, concurrency, the `DEPLOY_PROD` gate).
- **GitHub (repository settings, by hand):**
  - environment `prod` limited to `main`, with its secrets;
  - repository variable `DEPLOY_PROD`.
- **Azure (by hand, in UNDP's subscription):**
  - the state account;
  - the `platform` apply;
  - two role assignments by an unconditional Owner;
  - the seed;
  - the first deploy.
- **Docs:** `docs/suggested_deployment.md`, `infra/README.md`, `docs/architecture.md` (the state account line).
- **Behaviour people will notice:** once `DEPLOY_PROD` is on, merging a release or a hotfix into `main` updates production within minutes. A deploy interrupts a raster ingestion in progress, as in `dev`.
