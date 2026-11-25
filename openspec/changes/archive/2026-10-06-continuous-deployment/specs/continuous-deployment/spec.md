## ADDED Requirements

### Requirement: Merging into dev deploys dev

A GitHub Actions workflow (`.github/workflows/deploy.yml`) SHALL deploy the `dev` environment on every push to the `dev` branch that changes:

- `apps/`;
- `infra/deploy.sh` or `infra/lib.sh`;
- `infra/terraform/apps/`;
- the workflow itself.

It SHALL run `infra/deploy.sh dev --yes` with the images tagged with the pushed commit, so the verification and rollback of the deploy script apply. Pushes that change only other paths SHALL NOT deploy. The workflow SHALL NOT apply the `platform` stack, seed the share or run country commands.

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

Deploy runs for an environment SHALL run one at a time. A run in progress SHALL NOT be cancelled by a newer push; the newer run SHALL wait and deploy afterwards.

#### Scenario: Two merges in quick succession

- **WHEN** a second merge into `dev` happens while the first one's deploy is running
- **THEN** the second deploy starts after the first finishes, and `dev` ends on the second commit

### Requirement: Manual redeploy

The workflow SHALL be runnable on demand from the `dev` branch. Without a tag, it builds and deploys that commit. With an existing image tag, it deploys those images without building (`--skip-build`).

#### Scenario: Redeploy an earlier image

- **WHEN** an operator runs the workflow on demand with a tag that exists in the registry
- **THEN** both apps are deployed with that tag and verified, without building images

### Requirement: Deploy identity with federated trust only

CI SHALL authenticate to Azure as a user-assigned managed identity (`monbo-<env>-deploy`), with no client secret or other stored credential. Its federated credential SHALL trust only tokens issued by GitHub Actions for `undp/monbo` with subject `repo:undp/monbo:environment:<env>`. The deploy job SHALL declare that GitHub Environment and request an OIDC token (`id-token: write`). No other workflow or job SHALL be able to obtain the identity's access.

#### Scenario: Pull request workflows can't deploy

- **WHEN** a pull request, including one from a fork, runs workflows
- **THEN** no job can obtain a token for the deploy identity, because none runs in the `dev` environment

### Requirement: GitHub Environment restricted to its branch

A GitHub Environment named after the Azure environment (`dev`) SHALL hold the deploy's secrets:

- the subscription id (`ARM_SUBSCRIPTION_ID`);
- the tenant id and the deploy identity's client id;
- the Google Maps keys;
- `ADMIN_SESSION_SECRET`.

Its deployment branch policy SHALL allow only the matching branch (`dev`). No Azure id or secret SHALL be committed to the repository.

#### Scenario: Another branch tries to use the environment

- **WHEN** a workflow run on a branch other than `dev` targets the `dev` environment
- **THEN** GitHub refuses to run the job, and its secrets are not exposed

### Requirement: Least-privilege roles, with the manual grants documented

The deploy identity SHALL hold only:

- Reader on the subscription;
- AcrPush on the environment's registry;
- Storage Blob Data Contributor on the Terraform state account;
- Contributor on the environment's apps resource group;
- Storage Account Key Operator Service Role on the environment's layer storage account.

Terraform SHALL assign the first three. The last two SHALL be assigned once by an Owner allowed to grant them. `docs/suggested_deployment.md` SHALL record the exact commands and how to verify them. The identity SHALL NOT be able to assign roles.

#### Scenario: New environment without the manual grants

- **WHEN** CI deploys an environment whose deploy identity lacks the two manual roles
- **THEN** the deploy fails with an authorization error before changing any app, and the documentation names the missing grants
