# Continuous Deployment

## Purpose

Define how merges deploy an environment without anyone running anything: what triggers a deploy,
the workflow and its serialization, rollback and summary, manual redeploys, the GitHub Environment
that holds the secrets, and the deploy identity with federated trust only and least-privilege roles,
including the grants made by hand.
## Requirements
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

### Requirement: Failed deploys fail the run and roll back

A deploy run SHALL fail when `infra/deploy.sh` fails. When the new revisions don't verify, the previous images SHALL be serving again before the run ends (the script's rollback). The run's summary SHALL show the environment, the image tag, the URLs, and whether the deploy succeeded or was rolled back.

#### Scenario: Broken image merged

- **WHEN** a merged change produces an API image that never becomes ready
- **THEN** users keep reaching the previous revision, the script rolls both apps back to the previous images, and the workflow run fails with the failed revision's log command

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

### Requirement: Deploy identity with federated trust only

CI SHALL authenticate to Azure as a user-assigned managed identity (`monbo-<env>-deploy`), with no client secret or other stored credential. Its federated credential SHALL trust only tokens issued by GitHub Actions for `undp/monbo` with subject `repo:undp/monbo:environment:<env>`. The deploy job SHALL declare that GitHub Environment and request an OIDC token (`id-token: write`). No other workflow or job SHALL be able to obtain the identity's access.

#### Scenario: Pull request workflows can't deploy

- **WHEN** a pull request, including one from a fork, runs workflows
- **THEN** no job can obtain a token for the deploy identity, because none runs in the `dev` environment

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

The deploy identity SHALL hold only Contributor on its environment's resource group. That covers applying the apps, reading the storage and state keys, and pushing images. An administrator allowed to assign roles SHALL grant it once, together with AcrPull on the environment's registry for the pull identity:

- in Inventures' subscription, an Owner without an ABAC condition;
- in UNDP's, a UNDP administrator.

Terraform SHALL assign no roles. `docs/suggested_deployment.md` SHALL record the exact commands, for any environment, and how to verify them. The identity SHALL NOT be able to assign roles, nor access another environment's group or state.

#### Scenario: New environment without the manual grants

- **WHEN** CI deploys an environment whose deploy identity lacks Contributor on its group
- **THEN** the deploy fails with an authorization error before changing any app, and the documentation names the missing grant

#### Scenario: Identities are per environment

- **WHEN** both environments' grants are made
- **THEN** `monbo-dev-deploy` holds Contributor on `monbo-dev` only, `monbo-prod-deploy` holds Contributor on the group UNDP granted only, and neither has a role in the other's subscription

#### Scenario: Production CI before the grants

- **WHEN** `DEPLOY_PROD` is not `true` because the administrator has not granted Contributor to `monbo-prod-deploy` yet
- **THEN** pushes to `main` skip the deploy job, and `prod` is deployed by hand with `infra/deploy.sh prod`

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
