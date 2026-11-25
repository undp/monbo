## Context

On 2026-11-23 we checked the access UNDP granted in its tenant with the effective-permissions API (`Microsoft.Authorization/permissions`), which counts group and inherited assignments:

- **Subscription scope** (a subscription shared with other UNDP apps): no permissions.
- **The resource group UNDP granted** (in another region than East US): Contributor and Reader. That is `*` except `Microsoft.Authorization/*/Write|Delete`.
- **Resource providers:** the six Monbo uses are registered.
- **Names:** `monboprodtfstate`, `monboproddata` and `monboprodacr` are free.
- **Existing resources:** the group already holds an old manual Monbo deployment.
- **Logins:** UNDP's conditional access expires `az` logins after 24 hours (`AADSTS70043`).

The four-group design of `production-environment` needs, in that subscription:
- creating groups;
- role assignments (Reader, AcrPush and Storage Blob Data Contributor for the deploy identity; AcrPull for the pull identity);
- a `CanNotDelete` lock;
- a data role on the state account for the operator.

Contributor on one group allows none of those. Azure Files backup is most likely blocked too, because registering the account with a vault places `AzureBackupProtectionLock` on it, and the role Azure documents for it (Storage Account Backup Contributor) includes `Microsoft.Authorization/locks/*`.

`dev` runs in Inventures' subscription, where operators are Owners with an ABAC condition (they may assign Reader, Storage Blob Data *, AcrPull, AcrPush and AcrDelete). It uses the four-group design with Terraform-managed roles. It is the test environment for production.

## Goals / Non-Goals

**Goals:**
- One layout for both environments, so `dev` exercises exactly what `prod` runs: the group, the roles, the registry pull, the state access and the CI path.
- Nothing in that layout needs more than Contributor on the environment's group, except the two role grants an administrator makes once.
- `prod` deployable by hand with the access we have today; CI switched on after the grants with no further code change.
- Each relaxation reversible by a tfvars switch where the access may widen (registry admin, backup).

**Non-Goals:**
- Migrating `dev`'s layers, admin edits, usage events or passkeys. It is reseeded from Git.
- Reusing or retiring the old deployment in UNDP's group. That is UNDP's call.
- Replacing Azure Backup with another snapshot schedule.
- A custom domain.
- Keeping the four-group layout as an option.

## Decisions

### D1. `resource_group_name` is required; the group is a data source

`platform` reads the group with `data "azurerm_resource_group"` and puts every resource in it. Resources take `location` from `var.location`, not from the group, because UNDP's group is in another region and production runs in eastus.

The group's name is configuration of the environment, not of the repository, like the subscription. The repository is public, and prod's group name is UNDP's internal naming (the subscription and tenant were already kept out of it, by `production-environment`). So:
- operators set `TF_VAR_resource_group_name` in `infra/envs/<env>.secrets.env`, and CI sets it from the GitHub Environment secret `TF_VAR_RESOURCE_GROUP_NAME` (a secret so the public logs mask it);
- both stacks read it as `var.resource_group_name`;
- `infra/lib.sh` requires it and passes it to the backends with `-backend-config=resource_group_name=…`, since a backend can't read variables;
- `deploy.sh` doesn't print it in the run's summary;
- `platform` outputs the name for `deploy.sh` and `layers-ops.sh`.

Who creates the group:
- `dev`'s group, `monbo-dev`, is created by `bootstrap.sh`, because Inventures' Owners can.
- `prod`'s group exists already.

`bootstrap.sh` creates a group only when it is missing, and never calls `az group create` on an existing one, which would overwrite its tags.

**Alternative rejected:** keep the four-group layout as an option for `dev`. That leaves an untested path in production (the one that matters) and two layouts to maintain. Nobody would use the second one.

### D2. Terraform assigns no roles; an administrator grants two

The deploy identity, its federated credential and the pull identity stay in Terraform, because Contributor can create them. Their roles are granted by hand:

| Grant | Covers |
|---|---|
| Contributor on the group, to `monbo-<env>-deploy` | Applying `apps`, listing the storage and state keys, push and pull on the registry (Contributor includes them), reading `platform`'s resources |
| AcrPull on `monbo<env>acr`, to `monbo-<env>-pull` | Image pulls by managed identity |

- In `dev`, AcrPull is within the ABAC condition, but Contributor isn't: an unconditional Owner grants it, as it did for the old manual roles.
- In `prod`, a UNDP administrator grants both.
- `platform` outputs the deploy identity's principal id and `apps` the pull identity's, for the request.

The deploy identity loses Reader on the subscription. It needed that because the provider listed providers and read the data and platform groups. The provider registers nothing (`resource_provider_registrations = "none"` with the six listed providers already registered), and everything it reads is in the group.

**Risk accepted:** in `prod`, Contributor on a shared group can change UNDP's other resources there. Only jobs in the `prod` GitHub Environment, limited to `main`, can get its token, and it can't assign roles.

### D3. Registry admin credentials until AcrPull exists

With `registry_admin_enabled` (a `platform` variable, published as an output):
- `platform` turns the registry's admin user on;
- `apps` reads `admin_username`/`admin_password` with `data "azurerm_container_registry"` at every apply;
- both apps carry a `registry-password` secret and a `registry` block with `username` and `password_secret_name`.

Without the switch, the block uses the pull identity. The identity stays attached either way, so switching is a tfvars change, a `platform` apply and a deploy. Both environments start with `true` and flip after their grant.

**Alternative rejected:** a platform output with the password. It would live in `platform`'s state and go stale on rotation.

### D4. No lock; backup behind `share_backup_enabled` (default `false`)

A lock on a shared group would also lock UNDP's other resources, and Contributor can't create locks anywhere, so the stacks create none. The vault, policy, backup container and protected share are created only with `share_backup_enabled`, which needs Storage Account Backup Contributor on the storage account.
- **Kept:** `prevent_destroy` on the account and the share, 14-day share soft delete, and `seed`'s snapshot before it empties the share.
- **Optional asks to the administrator:** a `CanNotDelete` lock on the storage account (not the group), and the backup role.

`dev` keeps the backup off too. Turning it on in `dev` would test a path `prod` can't use.

### D5. State in the group, read with the account key

`bootstrap.sh <group> <account> [location]` creates the state account in the group with shared-key access, versioning and 30-day soft delete, and creates the container with the key. It assigns no role, because Contributor can't.
- The backend blocks are empty. `envs/<env>.backend.hcl` names the group, account, container and key.
- `apps`'s remote state takes the group from `var.resource_group_name` and `state_storage_account_name` from `apps/envs/<env>.tfvars`.
- `infra/lib.sh` reads the account from the backend file and the group from `TF_VAR_resource_group_name`, and exports `ARM_ACCESS_KEY` (`az storage account keys list`) before each `terraform init`. Both the backend and `terraform_remote_state` read it from the environment.
- In CI, the deploy identity lists the key with its Contributor role.

**Trade-off:** anyone who can list the account's keys can read the state, which holds the secrets. That is the same set of people who can change the resources and read the Container App secrets. The state account is named `monbo<env>tfstate` in both environments.

### D6. `dev` is rebuilt, not migrated

The storage account and registry names are global, so the new `platform` apply needs the old `monbodevdata` and `monbodevacr` gone first. Moving the resources into one group (Azure's resource move plus `terraform import`/`moved`) would keep data nobody needs and leave the old roles, lock and vault to untangle.

The procedure, in `docs/suggested_deployment.md` ("Moving dev to one resource group"):
1. Disable the Deploy workflow.
2. Remove the old resources (lock, backup protection, storage account, vault, the subscription-scope Reader, the four groups).
3. Create the new `dev` from the branch: bootstrap, platform, seed, manual deploy, grants, `registry_admin_enabled = false`, the new `AZURE_CLIENT_ID`.
4. Merge, so CI deploys it, and re-enable the workflow.

## Risks / Trade-offs

- **[Deleting the storage account deletes the layers and all their snapshots, and no lock stops it]** → `prevent_destroy` stops Terraform. We ask for a lock on the account. The Git layers can always be reseeded; admin edits and usage events since the last snapshot can't be recovered.
- **[No daily backup]** → `seed` takes a snapshot before emptying the share, and the docs give the command to take one by hand before risky changes. We ask for the backup role.
- **[The state is readable with the account key]** → the readers are the people who already control the resources. Versioning and soft delete stay on.
- **[A registry password exists until AcrPull is granted]** → it is a Container App secret, read fresh at each deploy, and goes away with the switch.
- **[If the `apps` stack is destroyed, its pull identity is recreated and loses AcrPull]** → setting `registry_admin_enabled = true` brings pulls back until the grant is redone. Documented.
- **[`dev` is down for about an hour and its passkeys change]** → it is a test environment. The procedure pauses CI first.
- **[A merge into `dev` before the new `dev` exists would fail its deploy]** → the new `dev` is created from the branch before merging, and CI stays disabled until the merge.

## Migration Plan

1. Review the change and get the PR green; `dev` and `prod` stay as they are.
2. **Rebuild `dev`** with the procedure in D6, from the branch. The grants come from an unconditional Owner of Inventures' subscription. Merge; CI deploys `dev` with the new layout.
3. **`prod`:**
   1. the GitHub Environment `prod`;
   2. `bootstrap.sh "$TF_VAR_resource_group_name" monboprodtfstate eastus`;
   3. `platform`, the seed, and `deploy.sh prod` from `main` after the release.
4. **UNDP's administrator:** the two grants. Then `registry_admin_enabled = false`, the `prod` secrets and `DEPLOY_PROD = true`.
5. **Rollback:** before step 2, revert the branch. After it, `dev` can't return to the old layout without recreating it again, which is acceptable for a test environment.

## Open Questions

- Will UNDP grant the lock and the backup role? If yes, `share_backup_enabled = true` in both environments, so they stay alike.
- Do UNDP's Azure Policies allow storage account keys, public endpoints on storage, the registry and Container Apps, and federated credentials? Asked in the request to the administrator.
