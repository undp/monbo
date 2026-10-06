## ADDED Requirements

### Requirement: Deploy identity declared in the platform stack

The `platform` stack SHALL declare each environment's deploy identity (`monbo-<env>-deploy`), its GitHub federated credential, and the role assignments that the operators are allowed to grant. It SHALL output the identity's client id and the tenant id, for the GitHub Environment's secrets. `infra/deploy.sh` and `infra/lib.sh` SHALL work when their variables come from the process environment instead of a secrets file, and when Azure CLI and Terraform authenticate as that identity through OIDC.

#### Scenario: Platform outputs for CI

- **WHEN** the `platform` stack of `dev` is applied
- **THEN** its outputs include the deploy identity's client id and the tenant id, and the identity has its federated credential and its Terraform-managed roles

#### Scenario: Deploy without a secrets file

- **WHEN** `infra/deploy.sh dev --yes` runs with `ARM_SUBSCRIPTION_ID`, `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_USE_OIDC` and the `TF_VAR_*` secrets exported, and no `infra/envs/dev.secrets.env`
- **THEN** it deploys exactly as it does for an operator
