## RENAMED Requirements

- FROM: `### Requirement: Remote state protected by Entra ID`
- TO: `### Requirement: Remote state in a dedicated account`

## MODIFIED Requirements

### Requirement: Environment declared in Terraform

Every Azure resource of a Monbo environment SHALL be declared in Terraform under `infra/terraform/`, using the azurerm provider, with `required_version` and provider versions pinned and the `.terraform.lock.hcl` files committed. Nothing in the environment SHALL be created or changed by an imperative script or by hand, except:

- the environment's resource group, when it doesn't exist, and the Terraform state account (both created by `infra/bootstrap.sh`);
- the role grants an administrator makes;
- data on the share.

A change made outside Terraform SHALL show up as drift in the next `terraform plan`.

#### Scenario: Plan before change

- **WHEN** an operator runs `terraform plan` for a stack and environment
- **THEN** the plan lists every resource that would be created, changed or destroyed, before anything changes

#### Scenario: Portal change detected

- **WHEN** someone changes an API Container App setting in the portal
- **THEN** the next `terraform plan` of the `apps` stack shows the difference and the next apply reverts it

### Requirement: Platform and apps stacks

Each environment SHALL live in one existing resource group, named by the stacks' required `resource_group_name`. Both stacks SHALL put every resource in that group and in the environment's `location`. They SHALL NOT create, modify or lock any resource group, create any lock, or assign any role, so that applying them needs no more than Contributor on the group.

Each environment SHALL have two Terraform stacks with separate state:

- `platform`: the storage account and share, the container registry, the Log Analytics workspace, and the deploy identity with its federated credential; with `share_backup_enabled`, also the backup vault, its policy and the protected share;
- `apps`: the Container Apps environment (sending logs to the Log Analytics workspace), the share's environment storage, the pull identity, and the API and web Container Apps.

`apps` SHALL read `platform`'s outputs through remote state, including the group. The storage account, the share, the recovery vault and the protected share SHALL have `prevent_destroy`. Destroying the `apps` stack SHALL leave every `platform` resource intact.

#### Scenario: Destroying the apps keeps the data

- **WHEN** an operator runs `terraform destroy` on the `apps` stack of an environment
- **THEN** the share, its layers, the registry and the Log Analytics workspace remain

#### Scenario: Data cannot be destroyed by an apply

- **WHEN** a plan of the `platform` stack would destroy the storage account or the share
- **THEN** Terraform refuses because of `prevent_destroy`

#### Scenario: Contributor on the group is enough

- **WHEN** an operator who only holds Contributor on the environment's group applies both stacks
- **THEN** every resource is created in that group, in the environment's `location`, and no group, lock or role assignment is created or changed

### Requirement: Environments are configuration

Each stack SHALL take its environment from `envs/<env>.tfvars` (non-secret settings) and `envs/<env>.backend.hcl` (the group, state account and state key `<env>/<stack>.tfstate`). Resource names SHALL derive from the environment name (`monbo-<env>-…`). The storage accounts and the registry, whose names are globally unique and cannot contain hyphens, SHALL be named `monbo<env>data`, `monbo<env>tfstate` and `monbo<env>acr`, with an optional suffix for the data account and the registry only when a name is taken. Adding an environment SHALL require only a group, new tfvars, backend and secrets files.

There SHALL be two environments, with the same layout and settings except their names and the testing-environment banner:

- `dev`, deployed from the `dev` branch, in its group `monbo-dev`, which shows the banner;
- `prod`, deployed from the `main` branch, in the group UNDP granted, which hides it.

Both SHALL run in `eastus`. Each MAY live in its own subscription and Entra tenant. No subscription, tenant, resource group or other account-specific Azure name SHALL be committed: the group, like the subscription, SHALL come from the environment (`TF_VAR_resource_group_name`, from the secrets file or the GitHub Environment), and the scripts SHALL refuse to run without it.

#### Scenario: Dev mirrors prod

- **WHEN** the `platform/envs/dev.tfvars` and `platform/envs/prod.tfvars` files are compared
- **THEN** they differ only in `env`, and in `registry_admin_enabled` while only one environment's pull identity holds AcrPull

#### Scenario: Group missing from the environment

- **WHEN** an operator runs `infra/deploy.sh prod` without `TF_VAR_resource_group_name` set or in the secrets file
- **THEN** the script stops before calling Azure and says where to set it, and no file in the repository names prod's group

#### Scenario: Default names

- **WHEN** the `dev` platform stack is planned without a suffix
- **THEN** everything is in `monbo-dev`, the storage account is `monbodevdata`, the registry is `monbodevacr` and the deploy identity is `monbo-dev-deploy`

#### Scenario: Production names

- **WHEN** the `prod` platform stack is planned without a suffix
- **THEN** everything is in the group given by `TF_VAR_resource_group_name`, the storage account is `monboproddata`, the registry is `monboprodacr` and the deploy identity is `monbo-prod-deploy`

### Requirement: Remote state in a dedicated account

Terraform state SHALL live in a dedicated storage account in the environment's group, `monbo<env>tfstate`, created by `infra/bootstrap.sh` with blob versioning and soft delete enabled and no public access. Each environment SHALL name its state account explicitly in both stacks' backend files and in `apps/envs/<env>.tfvars`, and its group through `TF_VAR_resource_group_name`; no stack SHALL default to another environment's. No state file SHALL be committed.

The backends SHALL read the state with the account's key, because Contributor can't grant a data role on the account. `infra/lib.sh` SHALL fetch the key with the caller's Azure login and export it as `ARM_ACCESS_KEY` before every `terraform init`, without writing it to disk or passing it as an argument.

#### Scenario: State read with the account key

- **WHEN** `infra/deploy.sh dev` initializes a stack
- **THEN** it fetches `monbodevtfstate`'s key with the current login and exports it for Terraform, and no key is written to disk

#### Scenario: Production state is separate

- **WHEN** an operator initializes either stack with `envs/prod.backend.hcl`
- **THEN** the state is read from `monboprodtfstate` in prod's group, and nothing of `dev`'s state is read or written

### Requirement: Registry pulls by managed identity

The Container Apps SHALL pull images with a user-assigned managed identity that holds `AcrPull` on the registry, and the registry SHALL have its admin user disabled.

Until an administrator has granted `AcrPull` to that identity, an environment SHALL set `registry_admin_enabled`. The registry's admin user is then on, and the apps pull with its credentials, read from the registry at each apply and kept only as a Container App secret. The pull identity SHALL stay attached to the apps either way, so that turning the switch off needs no other change.

#### Scenario: No registry credentials

- **WHEN** an operator inspects the API and web Container Apps of an environment whose `registry_admin_enabled` is `false`
- **THEN** their registry configuration references the managed identity and there is no registry password secret

#### Scenario: Admin credentials until AcrPull is granted

- **WHEN** an environment is deployed with `registry_admin_enabled = true`
- **THEN** both apps pull with the registry's admin username and a `registry-password` secret

#### Scenario: Back to the managed identity

- **WHEN** `registry_admin_enabled` is set to `false` after an administrator granted `AcrPull` to the pull identity, and `platform` and `apps` are applied
- **THEN** the registry's admin user is off and both apps pull with the pull identity

### Requirement: Environment rebuilt from Git

An environment SHALL be creatable from nothing with:

1. `infra/bootstrap.sh <group> <state-account> [location]` (once per environment);
2. a `platform` apply;
3. the seed command;
4. `infra/deploy.sh <env>`;
5. the administrator's two grants, then `registry_admin_enabled = false`.

The only data it needs SHALL be the Git-tracked layers. The following SHALL be documented in `docs/suggested_deployment.md`:

- the procedure and the extra steps to deploy an environment from CI;
- the exact grants to request and how to verify them;
- what the layers lack without the lock and the backup;
- the removal of the four-group `dev` and of the pre-Terraform environment.

#### Scenario: Fresh dev environment

- **WHEN** an operator follows the documented procedure in a subscription without Monbo resources
- **THEN** the dev environment serves CO, CR, and EC with their Git layers from the group `monbo-dev`, and three country passkeys have been printed once

#### Scenario: Fresh production environment

- **WHEN** an operator with Contributor on the group UNDP granted only follows the documented procedure for `prod`
- **THEN** `prod` serves CO, CR, and EC with their Git layers and without the testing banner, its own country passkeys have been printed once, no step needed a permission beyond Contributor on that group, and `dev` is unchanged

### Requirement: Deploy identity declared in the platform stack

The `platform` stack SHALL declare each environment's deploy identity (`monbo-<env>-deploy`) and its GitHub federated credential, and no role assignment. The stacks SHALL output the deploy identity's client id and principal id, the pull identity's principal id, and the tenant id, for the GitHub Environment's secrets and for the administrator's grants. `infra/deploy.sh` and `infra/lib.sh` SHALL work when their variables come from the process environment instead of a secrets file, and when Azure CLI and Terraform authenticate as that identity through OIDC.

#### Scenario: Platform outputs for CI

- **WHEN** the `platform` stack of `dev` is applied
- **THEN** its outputs include the deploy identity's client id and principal id and the tenant id, and the identity has its federated credential

#### Scenario: Deploy without a secrets file

- **WHEN** `infra/deploy.sh dev --yes` runs with `ARM_SUBSCRIPTION_ID`, `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_USE_OIDC` and the `TF_VAR_*` secrets exported, and no `infra/envs/dev.secrets.env`
- **THEN** it deploys exactly as it does for an operator
