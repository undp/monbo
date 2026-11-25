## MODIFIED Requirements

### Requirement: Persistent layer storage outside the app lifecycle

Layer data in Azure SHALL live on an Azure Files share in a Storage Account declared in the Terraform `platform` stack, in the environment's resource group, separate from the `apps` stack that holds the Container Apps. Share soft delete SHALL be enabled with a retention of at least 14 days. The Storage Account SHALL require TLS 1.2 or later and SHALL disable public blob access. The storage account and the share SHALL carry `prevent_destroy`.

Because the stacks need no more than Contributor on the group, they SHALL NOT create a delete lock. The daily backup (snapshots kept at least 30 days) SHALL exist only with `share_backup_enabled`, off in both environments until the role to configure it is granted. `docs/suggested_deployment.md` SHALL state what the layers lack without the lock and the backup, how to take a snapshot by hand, and which grants restore both.

#### Scenario: Destroying the app environment keeps layers

- **WHEN** an operator runs `terraform destroy` on the `apps` stack
- **THEN** the storage account, the share, and all layers remain intact

#### Scenario: Restoring from a snapshot

- **WHEN** a layer file is deleted or corrupted on the share
- **THEN** it can be restored from a share snapshot (the one `seed` took, or one taken by hand), or from the daily backup where `share_backup_enabled` is on

#### Scenario: Backup when the role is granted

- **WHEN** `share_backup_enabled` is set to `true` and `platform` is applied by an operator holding the backup role
- **THEN** the share gets daily snapshots at 06:00 UTC kept 30 days, in the vault `monbo-<env>-backup`
