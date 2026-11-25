## Why

`production-environment` assumes subscription-wide access in UNDP's Azure: Terraform creates four resource groups, assigns roles to the deploy and pull identities, puts a delete lock on the data, and the operator gets a data role on the Terraform state account. The access UNDP granted is narrower. It is Contributor on one existing resource group, in a shared subscription, with no permission at subscription scope. That role can create every resource Monbo runs on, but it can't create resource groups, assign roles or create locks.

`dev` is meant to be production's test environment: what it deploys should be what production runs. Keeping `dev` on the four-group layout would leave production's layout untested until it is in front of users, and keep two code paths alive. Its layers are only Git's plus test edits, so it can be rebuilt from nothing.

## What Changes

- **BREAKING: Every environment lives in one resource group.** Both stacks take `resource_group_name` (required) and put every resource in that group, which is read, never created, modified or locked:
  - `prod`: the group UNDP granted;
  - `dev`: `monbo-dev`, created by `bootstrap.sh`.

  The group is configuration of the environment, like the subscription: `TF_VAR_resource_group_name` in `infra/envs/<env>.secrets.env` and a GitHub Environment secret, passed to the backends by `infra/lib.sh`. The repository is public, and prod's group name is UNDP's, so it is never committed.

  `monbo-<env>-data`, `-platform`, `-apps` and `monbo-tfstate` are gone. Resources take their region from `location`; both environments use `eastus` (`dev` moves from `eastus2`).
- **BREAKING: Terraform assigns no roles.** The deploy identity and its federated credential, and the pull identity, are still declared. An administrator grants, once:
  - Contributor on the group to the deploy identity, which covers everything CI does;
  - AcrPull on the registry to the pull identity.

  This replaces the five roles the deploy identity held and the Terraform-managed AcrPull.
- **The registry admin user, until AcrPull is granted.** With `registry_admin_enabled`, the apps pull with the registry's admin credentials, read at each apply and kept only as a Container App secret. Set back to `false` once AcrPull exists.
- **BREAKING: No delete lock, and the share backup is optional and off.** Configuring either needs more than Contributor. `share_backup_enabled` brings the vault and daily backup back where the role is granted. The share keeps `prevent_destroy`, soft delete and `seed`'s snapshots.
- **BREAKING: The Terraform state is read with the account key.**
  - Each environment's state account (`monbodevtfstate`, `monboprodtfstate`) is in its group, with shared-key access.
  - `infra/lib.sh` exports its key as `ARM_ACCESS_KEY` before every `terraform init`.
  - `infra/bootstrap.sh <group> <state-account> [location]` creates the group only when it is missing, and assigns no role.
- **`infra/deploy.sh` and `tools/layers-ops`** take the group from `platform`'s outputs.
- **`dev` is rebuilt.** The old `dev` (four groups, lock, backup, roles, `monbotfstate`) is removed, the new one is created and seeded from Git with new passkeys, and the merge deploys it from CI.
- **Docs.**
  - `docs/suggested_deployment.md`: the single-group procedure for both environments, the administrator's grants, what the layers lose without the lock and the backup, production's steps, and how the old `dev` was removed.
  - `infra/README.md`, `docs/architecture.md`, `docs/maps.md` and `CHANGELOG.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `infrastructure-as-code`:
  - one existing group per environment, with no group, lock or role created by Terraform;
  - `dev` mirrors `prod`;
  - the state account is in the group and read with its key;
  - the registry admin user is allowed until AcrPull is granted;
  - the deploy identity's roles come from an administrator.
- `continuous-deployment`: the deploy identity holds only Contributor on its environment's group, granted once by an administrator.
- `layer-storage-infrastructure`: the layers are in the environment's group, without a dedicated group or lock; the daily backup is optional; recovery relies on soft delete and share snapshots until the backup is enabled.

## Impact

- **Terraform:**
  - `platform`: no groups, lock or role assignments; optional backup; registry admin switch; new outputs;
  - `apps`: no group or AcrPull; registry admin credentials; state read with the key;
  - every `envs/*` file;
  - tests rewritten for the single layout.
- **Scripts:** `infra/bootstrap.sh` (new arguments, key-based account), `infra/lib.sh` (state key, group output), `infra/deploy.sh`, `tools/layers-ops/layers-ops.sh` (a comment).
- **Docs:** `docs/suggested_deployment.md`, `infra/README.md`, `docs/architecture.md`, `docs/maps.md`, `CHANGELOG.md`.
- **Azure, by hand:**
  - Inventures':
    - removing the old `dev`;
    - creating the new one;
    - an Owner without an ABAC condition grants the two roles.
  - UNDP's:
    - the first deploy of `prod`;
    - a UNDP administrator grants the two roles.
- **GitHub:** `dev`'s `AZURE_CLIENT_ID` changes (new identity). The workflow is unchanged.
- **Trade-offs accepted for both environments:**
  - no delete lock;
  - no daily backup until the role is granted;
  - the state is readable by anyone who can list the account's keys;
  - a registry password until AcrPull is granted;
  - in `prod`, the deploy identity is Contributor on a group it shares with other UNDP resources.
- **Downtime:** `dev` is down from the removal of the old environment until the first deploy of the new one (about an hour). Its admin edits, usage events and passkeys are not kept.
