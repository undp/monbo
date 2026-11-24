## 1. Terraform: platform (D1–D5)

- [x] 1.1 `variables.tf`:
  - `resource_group_name` (required);
  - `registry_admin_enabled` (default `false`);
  - `share_backup_enabled` (default `false`);
  - the state account variables removed (no role on the state any more)
- [x] 1.2 `main.tf`:
  - the group as a data source, no groups and no lock;
  - every resource in the group and in `var.location`;
  - the vault, policy, backup container and protected share behind `share_backup_enabled`;
  - the registry's `admin_enabled` from `registry_admin_enabled`
- [x] 1.3 `deploy.tf`: the identity and its federated credential only; no role assignments, no subscription or state data sources
- [x] 1.4 `outputs.tf`: `resource_group_name` and `registry_admin_enabled`; `backup_vault_name` empty without the backup; the data group output removed
- [x] 1.5 `versions.tf`: empty backend block (the key comes from `ARM_ACCESS_KEY`); `envs/*.backend.hcl` name each environment's group and `monbo<env>tfstate`
- [x] 1.6 `envs/dev.tfvars` and `envs/prod.tfvars`: the same settings, only `env` and `resource_group_name` differ (`location = "eastus"`, `registry_admin_enabled = true`, `share_backup_enabled = false`)
- [x] 1.7 `tests/platform.tftest.hcl` rewritten:
  - everything in the group and region;
  - suffix;
  - protection;
  - backup on and off;
  - the registry admin switch;
  - invalid suffix;
  - the federated credential and outputs;
  - a prod run

## 2. Terraform: apps (D1–D3, D5)

- [x] 2.1 `data.tf`: remote state without Entra auth; `local.group` from `platform`; the registry data source for the admin credentials
- [x] 2.2 `main.tf`: no group and no AcrPull; everything in `local.group` and `platform`'s location
- [x] 2.3 `api.tf`, `web.tf`:
  - `registry` uses the identity, or the admin username with a `registry-password` secret;
  - the `depends_on` on AcrPull is removed
- [x] 2.4 `outputs.tf`: `resource_group_name` and `pull_identity_principal_id`
- [x] 2.5 `variables.tf`: `resource_group_name` (required, shared with the remote state); `envs/*.tfvars` name the state account
- [x] 2.6 `tests/apps.tftest.hcl`:
  - platform outputs for the new layout;
  - a run for the registry admin;
  - a run checking everything is in the platform's group and the pull identity's output
- [x] 2.7 `terraform fmt -check -recursive`, `init -backend=false`, `validate` and `test` in both stacks

## 3. Scripts (D1, D5)

- [x] 3.1 `infra/bootstrap.sh <group> <account> [location]`:
  - creates the group only when missing;
  - creates the state account with its key, versioning and soft delete;
  - creates the container with the key;
  - assigns no role
- [x] 3.2 `infra/lib.sh`: `export_state_key` before every `terraform init`; `RESOURCE_GROUP` from `platform`'s outputs
- [x] 3.3 `infra/deploy.sh`: the apps' group is `RESOURCE_GROUP`
- [x] 3.4 `tools/layers-ops/layers-ops.sh`: the comment about the daily backup
- [x] 3.5 `bash -n` on the changed scripts; `backend_value` checked against both backend files
  - shellcheck isn't installed on the machine this was written on.

## 4. Docs

- [x] 4.1 `docs/suggested_deployment.md`:
  - the one-group layout and the dev/prod table;
  - the state key;
  - creating an environment;
  - the administrator's grants;
  - CI auth;
  - Production;
  - Layer storage (what the layers lack, manual snapshots);
  - Rollback;
  - "Moving dev to one resource group"
- [x] 4.2 `infra/README.md`: the pieces, the diagram, the flow, "One resource group per environment", values, names, adding an environment, tests
- [x] 4.3 `docs/architecture.md`: the diagram, one resource table, what protects the layers, what survives what
- [x] 4.4 `docs/maps.md`: backups are share snapshots unless `share_backup_enabled`
- [x] 4.5 `CHANGELOG.md`: one entry under Unreleased

## 5. The group out of the repository

- [x] 5.0 The group comes from `TF_VAR_resource_group_name`, like the subscription (the repository is public; prod's group is UNDP's):
  - `lib.sh` requires it, passes it to the backends with `-backend-config`, and fetches the state key with it;
  - `deploy.yml` maps the `TF_VAR_RESOURCE_GROUP_NAME` secret;
  - the `.example` files, docs, specs, tests and CHANGELOG name no UNDP group, subscription or app

## 6. Verification

- [x] 6.1 `openspec validate single-resource-group --strict`
- [x] 6.2 With a fresh `az login` into UNDP's tenant: a read-only `platform` plan for `prod` with a local backend. It should only create resources in UNDP's group (no group, lock or role), and confirm that the provider's registration check passes with Contributor on the group only
  - 2026-11-24: `Plan: 6 to add, 0 to change, 0 to destroy`. It creates `monboprodacr` (admin on), `monbo-prod-logs`, `monboproddata` and its `maps` share, `monbo-prod-deploy` and its federated credential, all in UNDP's group, `eastus`. Reading the group and the provider check pass with Contributor only.
- [ ] 6.3 Rebuild `dev` ("Moving dev to one resource group" in `docs/suggested_deployment.md`), from the branch:
  - [x] remove the old `dev` (2026-11-24; `monbo-dev-data` with the empty vault waits for 6.4b);
  - [x] create the new one up to the manual deploy (`monbo-dev`, eastus; passkeys rotated after the seed);
  - [x] AcrPull to `monbo-dev-pull` (the operators' ABAC condition allows it), `registry_admin_enabled = false`, verified;
  - [x] the new `AZURE_CLIENT_ID` and `TF_VAR_RESOURCE_GROUP_NAME` in the `dev` GitHub Environment;
  - [ ] Contributor on `monbo-dev` to `monbo-dev-deploy`, by an Owner without an ABAC condition (the operators' condition refuses it)
  - Found on the way: new Container Apps environments come with the Consumption workload profile (now declared, so plans show no changes), and one transient 403 reading the state after the 10-minute apply (`deploy.sh` now retries reading its outputs).
- [ ] 6.4 Merge, re-enable the Deploy workflow, and confirm the merge deploys `dev` from CI
- [ ] 6.4b After the soft-deleted backup item is purged (from 2026-12-08): unregister the old account, delete `monbo-dev-backup` and the group `monbo-dev-data` (docs, "Moving dev to one resource group")
- [ ] 6.5 `prod` (Production in `docs/suggested_deployment.md`): the manual deploy, then the UNDP administrator's grants, `registry_admin_enabled = false`, the `prod` secrets and `DEPLOY_PROD`
