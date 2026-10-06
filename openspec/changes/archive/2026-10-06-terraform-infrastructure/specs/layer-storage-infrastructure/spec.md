## MODIFIED Requirements

### Requirement: Persistent layer storage outside the app lifecycle

Layer data in Azure SHALL live on an Azure Files share in a Storage Account inside a dedicated resource group, separate from the resource group that holds the Container Apps, and declared in the Terraform `platform` stack. That resource group SHALL carry a `CanNotDelete` lock. Share soft delete SHALL be enabled with a retention of at least 14 days, and the share SHALL have daily snapshots kept for at least 30 days. The Storage Account SHALL require TLS 1.2 or later and SHALL disable public blob access.

#### Scenario: Destroying the app environment keeps layers

- **WHEN** an operator runs `terraform destroy` on the `apps` stack
- **THEN** the storage resource group, the share, and all layers remain intact

#### Scenario: Accidental deletion is recoverable

- **WHEN** a layer file is deleted or corrupted on the share
- **THEN** it can be restored from a share snapshot taken within the retention period

### Requirement: Seeding the share in the per-country layout

`tools/layers-ops/layers-ops.sh <env> seed` SHALL fill the environment's share, whose names it reads from the Terraform `platform` outputs, with the Git-tracked layers in the per-country layout:

- every raster SHALL go through the seed command's validation and COG conversion, and the result through the migration;
- the passkey of every country SHALL be printed once;
- each country's id mapping SHALL be written to a local file (`SEED_MAPPING_OUT`);
- the result SHALL be uploaded to the share's root.

When the share already has files, the command SHALL ask the operator to type the share's name before doing anything, and SHALL delete the share's files only after the new layers are ready locally. If the confirmation or the preparation fails, the share SHALL be unchanged. The command SHALL be run by an operator, never from CI, because it prints passkeys.

#### Scenario: First setup

- **WHEN** an operator runs `tools/layers-ops/layers-ops.sh dev seed` on an empty share
- **THEN** the share has `countries.json` and the `CO/`, `CR/`, and `EC/` folders with their layers, and three passkeys are printed

#### Scenario: Starting an environment over

- **WHEN** an operator runs the seed command on a share that already has layers and types the share's name
- **THEN** every previous file is deleted and the share holds only the per-country layout from Git

#### Scenario: Confirmation refused

- **WHEN** the operator types anything other than the share's name
- **THEN** the command stops and the share is unchanged

### Requirement: Deploying the API requires layer storage

The deployment SHALL NOT deploy the API without layer storage. The Terraform `apps` stack SHALL always mount the `platform` share into the API at `/mnt/maps` and set `MAPS_ROOT=/mnt/maps`; it has no configuration without the share. `infra/deploy.sh` SHALL stop before building or applying when the share has no `countries.json`.

#### Scenario: Every revision mounts the share

- **WHEN** the API is deployed
- **THEN** its Container App has the `maps` volume mounted at `/mnt/maps` and `MAPS_ROOT=/mnt/maps`

#### Scenario: Unseeded share refused

- **WHEN** an operator deploys to an environment whose share has no `countries.json`
- **THEN** the deploy stops before building images or applying, with instructions to seed the share

## ADDED Requirements

### Requirement: Country commands against the share

`tools/layers-ops/layers-ops.sh <env> countries <add|list|rotate|disable|enable> [CC]` SHALL run the country registry command against the environment's share, without redeploying or restarting the API. `unlock` releases a stale registry lease after confirmation. The command SHALL use a temporary local copy and upload only what changed. It SHALL abort without uploading if `countries.json` changed on the share while the command was running.

#### Scenario: Add a country in Azure

- **WHEN** an operator runs `tools/layers-ops/layers-ops.sh dev countries add PE`
- **THEN** `PE/` and the updated `countries.json` exist on the share, the passkey is printed once, and PE's admin can log in without an API restart

#### Scenario: Concurrent registry edit

- **WHEN** the share's `countries.json` changes between the command's download and its upload
- **THEN** the command aborts without uploading and asks the operator to retry

## REMOVED Requirements

### Requirement: Deployment script provisions and verifies storage

**Reason**: `azure/deploy.sh` and `azure/render_api_app.py` are replaced by Terraform. The storage, its protection and the apps are declared in the `platform` and `apps` stacks (`infrastructure-as-code`). The seeded-share check and the `/health` verification move to `infra/deploy.sh`.

**Migration**: Use `infra/bootstrap.sh` once, apply `infra/terraform/platform` for the environment, seed with `tools/layers-ops/layers-ops.sh <env> seed`, and deploy with `infra/deploy.sh <env>` (docs/suggested_deployment.md).

### Requirement: Country commands in the deployment script

**Reason**: The command moves out of the deleted `azure/deploy.sh` into `tools/layers-ops/`, with unchanged behaviour (see "Country commands against the share").

**Migration**: Replace `./azure/deploy.sh countries <cmd> [CC]` with `tools/layers-ops/layers-ops.sh <env> countries <cmd> [CC]`.
