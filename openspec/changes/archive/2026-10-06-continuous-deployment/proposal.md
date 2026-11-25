## Why

Deploying `dev` still means someone runs `infra/deploy.sh dev` from a laptop, with `infra/envs/dev.secrets.env`, Docker and an `az login`. So the environment lags behind the branch until someone remembers. Which commit is deployed depends on who ran it, and the secrets have to live on each operator's machine.

The technical review calls this the main operational risk left in the project. Changes 1–4 made it cheap to fix:

- the image no longer needs Git LFS;
- the infrastructure is declared in Terraform;
- `deploy.sh` is a single non-interactive entry point (`--yes`) that verifies the new revisions and rolls back a failed deploy.

## What Changes

- **Merging into `dev` deploys `dev`.** A new workflow, `.github/workflows/deploy.yml`, runs on pushes to `dev` that change what is deployed:
  - `apps/**`;
  - `infra/deploy.sh` and `infra/lib.sh`;
  - `infra/terraform/apps/**`;
  - the workflow itself.

  It checks out without LFS, logs in to Azure with OIDC, and runs `infra/deploy.sh dev --yes`, tagging the images with the commit. The run summary shows the URLs, the tag and whether it rolled back. Merges that only touch docs, specs or `platform` don't deploy. Dependabot merges do.
- **Manual redeploys.** `workflow_dispatch` runs the same workflow from the Actions tab, optionally with an existing tag (`--skip-build`), for example to go back to an earlier image.
- **One deploy at a time.** Deploys are serialized (`concurrency: deploy-dev`, never cancelled midway). A failed deploy is rolled back by `deploy.sh` and fails the run.
- **A deploy identity with no stored credentials.** `monbo-dev-deploy` is a user-assigned managed identity in `monbo-dev-platform`, declared in the Terraform `platform` stack. Its federated credential trusts only GitHub Actions jobs of `undp/monbo` that run in the GitHub Environment `dev`. There are no client secrets and no Entra app registration.
- **The identity's roles:**
  - **Terraform assigns** what the operators' ABAC condition allows: Reader on the subscription, AcrPush on the registry, and Storage Blob Data Contributor on the Terraform state account.
  - **Assigned once by hand by an unconditional Owner:** Contributor on `monbo-dev-apps`, and Storage Account Key Operator on `monbodevdata` (for the share check and the environment storage's key). The condition doesn't allow operators to grant them.
- **GitHub Environment `dev`.** It is restricted to the `dev` branch and holds the deploy's secrets:
  - the Azure ids: subscription, tenant, and the identity's client id;
  - the Google Maps keys;
  - `ADMIN_SESSION_SECRET`.
- **`deploy.sh` and `lib.sh` work under a managed identity in CI.** The variables come from the job's environment instead of a secrets file. Terraform authenticates with OIDC.
- **Out of scope:**
  - Terraform plans on pull requests (the repository is public; that needs its own design);
  - production deploys from `main`, though the workflow is parametrized by environment;
  - applying `platform`;
  - `seed` and `countries`.

## Capabilities

### New Capabilities

- `continuous-deployment`:
  - what triggers a deploy, and what doesn't;
  - the deploy workflow, and its serialization and rollback behaviour;
  - the GitHub Environment and its secrets;
  - the deploy identity, its federated trust and its roles, including the two assigned by hand;
  - manual redeploys.

### Modified Capabilities

- `infrastructure-as-code`: the environment's identities now include the deploy identity, declared in `platform`. CI runs `infra/deploy.sh` authenticated by OIDC, with no secrets file.

## Impact

- **New:** `.github/workflows/deploy.yml`.
- **Terraform:**
  - `infra/terraform/platform`: the deploy identity, its federated credential and three role assignments;
  - variables for the state account;
  - outputs: the identity's client id and the tenant id.
- **Scripts:**
  - `infra/lib.sh`: no secrets file required when the variables are set; works under a managed identity;
  - `infra/deploy.sh`: the run summary, if anything.
- **GitHub (repository settings):**
  - a new `dev` environment, limited to the `dev` branch;
  - its secrets.
- **Azure:**
  - one managed identity and its role assignments;
  - two role assignments requested from the subscription's unconditional Owner.
- **Docs:**
  - `infra/README.md`: the CD flow;
  - `docs/suggested_deployment.md`: setting up CD and the manual role step;
  - the root `README.md`;
  - `docs/branch_protection.md`: deploys aren't checks.
- **Behaviour people will notice:**
  - every merge into `dev` that touches the apps updates `dev` within minutes;
  - a deploy interrupts a raster ingestion in progress, as a manual deploy did.
