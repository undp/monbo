## MODIFIED Requirements

### Requirement: Environments are configuration

Each stack SHALL take its environment from `envs/<env>.tfvars` (non-secret settings) and `envs/<env>.backend.hcl` (state key `<env>/<stack>.tfstate`). Resource names SHALL derive from the environment name (`monbo-<env>-…`). The storage account and the registry, whose names are globally unique and cannot contain hyphens, SHALL be named `monbo<env>data` and `monbo<env>acr`, with an optional suffix only when a name is taken. Adding an environment SHALL require only new tfvars, backend and secrets files.

There SHALL be two environments:

- `dev`, deployed from the `dev` branch;
- `prod`, deployed from the `main` branch, which hides the testing-environment banner.

Each MAY live in its own subscription and Entra tenant. No subscription, tenant or other account-specific Azure name SHALL be committed.

#### Scenario: A second environment

- **WHEN** a maintainer applies `envs/prod.tfvars` and `envs/prod.backend.hcl` in both stacks
- **THEN** a separate environment is created with its own resource groups and state, without changing `dev`

#### Scenario: Default names

- **WHEN** the `dev` platform stack is planned without a suffix
- **THEN** its resource groups are `monbo-dev-data` and `monbo-dev-platform`, the storage account is `monbodevdata` and the registry is `monbodevacr`

#### Scenario: Production names

- **WHEN** the `prod` platform stack is planned without a suffix
- **THEN** its resource groups are `monbo-prod-data` and `monbo-prod-platform`, the storage account is `monboproddata` and the registry is `monboprodacr`

### Requirement: Remote state protected by Entra ID

Terraform state SHALL live in a dedicated storage account created by `infra/bootstrap.sh`, with shared-key access disabled, blob versioning and soft delete enabled, and no public access. Each environment SHALL name its state account explicitly in both stacks' backend and tfvars files: `monbotfstate` for `dev` and `monboprodtfstate` for `prod`, each in its environment's subscription. No stack SHALL default to another environment's state account. Backends SHALL authenticate with Entra ID (`use_azuread_auth`). No state file SHALL be committed.

#### Scenario: State without keys

- **WHEN** an operator initializes a stack with its backend file
- **THEN** Terraform reads and writes the state using the operator's Entra identity, and no storage account key is used or stored

#### Scenario: Production state is separate

- **WHEN** an operator initializes either stack with `envs/prod.backend.hcl`
- **THEN** the state is read from `monboprodtfstate` in prod's subscription, and nothing in `monbotfstate` is read or written

### Requirement: Environment rebuilt from Git

An environment SHALL be creatable from nothing with:

1. `infra/bootstrap.sh` (once per state account);
2. a `platform` apply;
3. the seed command;
4. `infra/deploy.sh <env>`.

The only data it needs SHALL be the Git-tracked layers. The procedure, the extra steps to deploy an environment from CI, what the Azure access must allow, and the removal of the pre-Terraform environment SHALL be documented in `docs/suggested_deployment.md`.

#### Scenario: Fresh dev environment

- **WHEN** an operator follows the documented procedure in a subscription without Monbo resources
- **THEN** the dev environment serves CO, CR, and EC with their Git layers, and three country passkeys have been printed once

#### Scenario: Fresh production environment

- **WHEN** an operator follows the documented procedure for `prod` in a subscription without Monbo resources
- **THEN** `prod` serves CO, CR, and EC with their Git layers and without the testing banner, its own country passkeys have been printed once, and `dev` is unchanged
