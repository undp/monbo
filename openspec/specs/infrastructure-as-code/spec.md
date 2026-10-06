# Infrastructure as Code

## Purpose

Define how Monbo's Azure environments are declared and deployed: Terraform stacks (`platform` and
`apps`) per environment, remote state with Entra ID access, secrets and the subscription kept out of
the repository, image pulls by managed identity, the single deploy script with its rollback, Terraform
checks in CI, and rebuilding an environment from the Git layers.

## Requirements
### Requirement: Environment declared in Terraform

Every Azure resource of a Monbo environment SHALL be declared in Terraform under `infra/terraform/`, using the azurerm provider, with `required_version` and provider versions pinned and the `.terraform.lock.hcl` files committed. Nothing in the environment SHALL be created or changed by an imperative script or by hand, except the Terraform state account (created by `infra/bootstrap.sh`) and data on the share. A change made outside Terraform SHALL show up as drift in the next `terraform plan`.

#### Scenario: Plan before change

- **WHEN** an operator runs `terraform plan` for a stack and environment
- **THEN** the plan lists every resource that would be created, changed or destroyed, before anything changes

#### Scenario: Portal change detected

- **WHEN** someone changes an API Container App setting in the portal
- **THEN** the next `terraform plan` of the `apps` stack shows the difference and the next apply reverts it

### Requirement: Platform and apps stacks

Each environment SHALL have two Terraform stacks with separate state:

- `platform`: the data resource group (storage account, share, backup vault and policy, protected share, `CanNotDelete` lock), the container registry, and the Log Analytics workspace;
- `apps`: the apps resource group, the Container Apps environment (sending logs to the Log Analytics workspace), the share's environment storage, the pull identity, and the API and web Container Apps.

`apps` SHALL read `platform`'s outputs through remote state. The storage account, the share, the recovery vault and the protected share SHALL have `prevent_destroy`. Destroying the `apps` stack SHALL leave every `platform` resource intact.

#### Scenario: Destroying the apps keeps the data

- **WHEN** an operator runs `terraform destroy` on the `apps` stack of an environment
- **THEN** the share, its layers, its backups, the registry and the Log Analytics workspace remain

#### Scenario: Data cannot be destroyed by an apply

- **WHEN** a plan of the `platform` stack would destroy the storage account or the share
- **THEN** Terraform refuses because of `prevent_destroy`

### Requirement: Environments are configuration

Each stack SHALL take its environment from `envs/<env>.tfvars` (non-secret settings) and `envs/<env>.backend.hcl` (state key `<env>/<stack>.tfstate`). Resource names SHALL derive from the environment name (`monbo-<env>-…`). The storage account and the registry, whose names are globally unique and cannot contain hyphens, SHALL be named `monbo<env>data` and `monbo<env>acr`, with an optional suffix only when a name is taken. Adding an environment SHALL require only new tfvars, backend and secrets files. This cycle SHALL create only `dev`, deployed from the `dev` branch.

#### Scenario: A second environment

- **WHEN** a maintainer adds `envs/prod.tfvars` and `envs/prod.backend.hcl` to both stacks
- **THEN** applying them creates a separate environment with its own resource groups and state, without changing `dev`

#### Scenario: Default names

- **WHEN** the `dev` platform stack is planned without a suffix
- **THEN** its resource groups are `monbo-dev-data` and `monbo-dev-platform`, the storage account is `monbodevdata` and the registry is `monbodevacr`

### Requirement: Remote state protected by Entra ID

Terraform state SHALL live in a dedicated storage account created by `infra/bootstrap.sh`, with shared-key access disabled, blob versioning and soft delete enabled, and no public access. Backends SHALL authenticate with Entra ID (`use_azuread_auth`). No state file SHALL be committed.

#### Scenario: State without keys

- **WHEN** an operator initializes a stack with its backend file
- **THEN** Terraform reads and writes the state using the operator's Entra identity, and no storage account key is used or stored

### Requirement: Secrets only as sensitive variables

The Azure subscription SHALL NOT appear in any repository file: Terraform, the az calls and the scripts SHALL take it from `ARM_SUBSCRIPTION_ID`. The Google Maps keys and `ADMIN_SESSION_SECRET` SHALL be `sensitive` Terraform variables without defaults, supplied through `TF_VAR_*` environment variables, from a git-ignored `infra/envs/<env>.secrets.env` for operators or from GitHub Environment secrets in CI. They SHALL reach the apps only as Container App secrets referenced by environment variables. No secret value SHALL be committed, and `ADMIN_SESSION_SECRET`, when set, SHALL be validated to be at least 32 characters.

#### Scenario: Secret file is ignored

- **WHEN** an operator creates `infra/envs/dev.secrets.env`
- **THEN** Git ignores it

#### Scenario: Subscription missing

- **WHEN** an operator runs `infra/deploy.sh dev` without `ARM_SUBSCRIPTION_ID` set or in the secrets file
- **THEN** the script stops before calling Azure and says where to set it

#### Scenario: Short admin secret rejected

- **WHEN** `admin_session_secret` has fewer than 32 characters
- **THEN** `terraform plan` fails validation before any change

### Requirement: Registry pulls by managed identity

The container registry SHALL have its admin user disabled. The Container Apps SHALL pull images with a user-assigned managed identity that holds `AcrPull` on the registry. No registry password SHALL exist in any secret or variable.

#### Scenario: No registry credentials

- **WHEN** an operator inspects the API and web Container Apps
- **THEN** their registry configuration references the managed identity and there is no registry password secret

### Requirement: Single deploy entry point

`infra/deploy.sh <env>` SHALL be the only way to deploy the apps, locally and from CI. It SHALL:

- read the `platform` outputs;
- stop before building or applying when the share has no `countries.json`, pointing to the seed command;
- build and push `monbo-api` and `monbo-front` for `linux/amd64`, tagged with the commit;
- apply the `apps` stack with those image references;
- verify that the API's `/health` reports `mapsRoot` `/mnt/maps` as writable, and that the web app answers its health check.

It SHALL NOT apply the `platform` stack.

The script SHALL record the image of each app's latest ready revision before applying. A deploy SHALL count as successful only when each app's latest revision is ready and runs the new image, and the health checks pass. If the apply fails or that verification fails, the script SHALL apply the recorded images to both apps, verify them, and exit with an error that names the failed revision. A first deploy, with no ready revision, SHALL fail without rolling back.

#### Scenario: New revision never becomes ready

- **WHEN** a deploy's API image fails its startup probe
- **THEN** users keep reaching the previous revision, the script applies the previously serving images to both apps, and it exits with an error naming the failed revision

#### Scenario: Old revision answering health checks

- **WHEN** the new API revision is not ready but the previous one still answers `/health`
- **THEN** the deploy is not reported as successful

#### Scenario: Unseeded share

- **WHEN** an operator runs `infra/deploy.sh dev` and the share has no `countries.json`
- **THEN** the script stops before building images or applying, with instructions to run the seed command

#### Scenario: Successful deploy

- **WHEN** an operator runs `infra/deploy.sh dev` on a seeded environment
- **THEN** both images are pushed with the commit's tag, the `apps` stack is applied with them, and the script ends after verifying both apps' health

#### Scenario: Mount missing after deploy

- **WHEN** the deployed API reports a maps root other than a writable `/mnt/maps`
- **THEN** the script fails with an explicit error

### Requirement: Terraform validated in CI

Change detection SHALL select a `Terraform` job when a pull request changes `infra/` or the CI workflow. The job SHALL run `terraform fmt -check` and, for each stack, `terraform init -backend=false` and `terraform validate`, with the pinned Terraform version and without Azure credentials. It SHALL fail open like the package jobs.

#### Scenario: Unformatted Terraform

- **WHEN** a pull request changes a `.tf` file that is not formatted
- **THEN** the `Terraform` job fails

#### Scenario: Unrelated pull request

- **WHEN** a pull request changes only `apps/web/`
- **THEN** the `Terraform` job is skipped

### Requirement: Environment rebuilt from Git

An environment SHALL be creatable from nothing with:

1. `infra/bootstrap.sh` (once per subscription);
2. a `platform` apply;
3. the seed command;
4. `infra/deploy.sh <env>`.

The only data it needs SHALL be the Git-tracked layers. The procedure, and the removal of the pre-Terraform environment, SHALL be documented in `docs/suggested_deployment.md`.

#### Scenario: Fresh dev environment

- **WHEN** an operator follows the documented procedure in a subscription without Monbo resources
- **THEN** the dev environment serves CO, CR, and EC with their Git layers, and three country passkeys have been printed once

