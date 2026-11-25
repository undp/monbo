## MODIFIED Requirements

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
