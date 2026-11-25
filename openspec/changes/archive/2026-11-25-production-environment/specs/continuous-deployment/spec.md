## ADDED Requirements

### Requirement: Merging into main deploys prod

The deploy workflow SHALL deploy the `prod` environment on every push to the `main` branch that changes the paths that deploy `dev`. It SHALL run `infra/deploy.sh prod --yes` with the images built from the pushed commit and tagged with it, in prod's registry. A push to `dev` SHALL deploy only `dev`, and a push to `main` SHALL deploy only `prod`. Pushes to `main` that change only other paths SHALL NOT deploy.

#### Scenario: Release merged

- **WHEN** a release pull request from `dev` that changes `apps/` is merged into `main`, and production deploys are switched on
- **THEN** the workflow builds both images from the merge commit, pushes them to prod's registry, deploys them to `prod`, and succeeds after the new revisions are verified

#### Scenario: Hotfix merged

- **WHEN** a hotfix pull request that changes `apps/web/` is merged into `main`, and production deploys are switched on
- **THEN** `prod` is deployed with the hotfix commit, and `dev` is deployed only when the follow-up `main` → `dev` pull request merges

### Requirement: Production deploys are switched on explicitly

Deploy runs on `main`, from a push or on demand, SHALL run only when the repository variable `DEPLOY_PROD` is `true`. Otherwise the deploy job SHALL be skipped, not failed, and SHALL NOT reference the `prod` GitHub Environment. Deploys of `dev` SHALL NOT depend on the variable.

#### Scenario: Release before production exists

- **WHEN** a release is merged into `main` and `DEPLOY_PROD` is not set
- **THEN** the deploy job is skipped, nothing in Azure changes, and the run is not marked as failed

#### Scenario: Turning production deploys off

- **WHEN** an operator sets `DEPLOY_PROD` to `false`
- **THEN** later merges into `main` don't deploy, and `infra/deploy.sh prod` keeps working by hand

## MODIFIED Requirements

### Requirement: Merging into dev deploys dev

A GitHub Actions workflow (`.github/workflows/deploy.yml`) SHALL deploy the `dev` environment on every push to the `dev` branch that changes:

- `apps/`;
- `infra/deploy.sh` or `infra/lib.sh`;
- `infra/terraform/apps/`;
- the workflow itself.

It SHALL run `infra/deploy.sh dev --yes` with the images tagged with the pushed commit, so the verification and rollback of the deploy script apply. Pushes that change only other paths SHALL NOT deploy. The workflow SHALL NOT apply the `platform` stack, seed the share or run country commands, in any environment.

#### Scenario: Application change merged

- **WHEN** a pull request that changes `apps/api/` is merged into `dev`
- **THEN** the workflow builds both images tagged with the merge commit, deploys them to `dev`, and succeeds after the new revisions are verified

#### Scenario: Documentation-only merge

- **WHEN** a pull request that changes only `docs/` is merged into `dev`
- **THEN** no deploy runs

#### Scenario: Platform change merged

- **WHEN** a pull request that changes only `infra/terraform/platform/` is merged into `dev`
- **THEN** no deploy runs, and the platform stack is applied by an operator after reading its plan

### Requirement: Deploys are serialized

Deploy runs for an environment SHALL run one at a time. A run in progress SHALL NOT be cancelled by a newer push; the newer run SHALL wait and deploy afterwards. Runs for different environments SHALL NOT wait for each other.

#### Scenario: Two merges in quick succession

- **WHEN** a second merge into `dev` happens while the first one's deploy is running
- **THEN** the second deploy starts after the first finishes, and `dev` ends on the second commit

#### Scenario: Deploys of different environments

- **WHEN** a hotfix merged into `main` deploys `prod` while a merge into `dev` is deploying `dev`
- **THEN** both deploys run without waiting for each other

### Requirement: Manual redeploy

The workflow SHALL be runnable on demand from the `dev` branch, deploying `dev`, and from the `main` branch, deploying `prod` (subject to `DEPLOY_PROD`). Without a tag, it builds and deploys that commit. With an existing image tag, it deploys those images without building (`--skip-build`). A run on any other branch SHALL NOT deploy.

#### Scenario: Redeploy an earlier image

- **WHEN** an operator runs the workflow on demand with a tag that exists in the registry
- **THEN** both apps are deployed with that tag and verified, without building images

#### Scenario: Roll production back

- **WHEN** an operator runs the workflow on demand on `main` with the tag of the previous production release
- **THEN** `prod` serves the previous images, and `dev` is untouched

#### Scenario: Manual run on a feature branch

- **WHEN** an operator runs the workflow on demand on a branch other than `dev` or `main`
- **THEN** GitHub refuses the job because of the environment's branch policy, and nothing is deployed

### Requirement: GitHub Environment restricted to its branch

Each Azure environment SHALL have a GitHub Environment with the same name, holding that environment's deploy secrets:

- the subscription id (`ARM_SUBSCRIPTION_ID`);
- the tenant id and the deploy identity's client id;
- the Google Maps keys;
- `ADMIN_SESSION_SECRET`.

The deployment branch policy SHALL allow only the matching branch: `dev` for `dev`, and `main` for `prod`. The `prod` environment, with its policy, SHALL exist before the federated credential that trusts it is created. No Azure id or secret SHALL be committed to the repository.

#### Scenario: Another branch tries to use the environment

- **WHEN** a workflow run on a branch other than `dev` targets the `dev` environment
- **THEN** GitHub refuses to run the job, and its secrets are not exposed

#### Scenario: dev cannot reach production

- **WHEN** a workflow run on `dev`, or on any branch other than `main`, targets the `prod` environment
- **THEN** GitHub refuses to run the job, and no token trusted by prod's deploy identity is issued

### Requirement: Least-privilege roles, with the manual grants documented

The deploy identity SHALL hold only:

- Reader on its environment's subscription;
- AcrPush on the environment's registry;
- Storage Blob Data Contributor on the environment's Terraform state account;
- Contributor on the environment's apps resource group;
- Storage Account Key Operator Service Role on the environment's layer storage account.

Terraform SHALL assign the first three. The last two SHALL be assigned once by an Owner allowed to grant them. `docs/suggested_deployment.md` SHALL record the exact commands, for any environment, and how to verify them. The identity SHALL NOT be able to assign roles, nor access another environment's state account.

#### Scenario: New environment without the manual grants

- **WHEN** CI deploys an environment whose deploy identity lacks the two manual roles
- **THEN** the deploy fails with an authorization error before changing any app, and the documentation names the missing grants

#### Scenario: Identities are per environment

- **WHEN** the `prod` platform stack is applied
- **THEN** `monbo-prod-deploy` gets Storage Blob Data Contributor on prod's state account only, and `monbo-dev-deploy` has no role in prod's subscription
