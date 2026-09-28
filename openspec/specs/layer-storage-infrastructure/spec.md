# Layer Storage Infrastructure

## Purpose

Define the Azure infrastructure that keeps layers across releases: the Azure Files share and its
protection, the mount into the API container, the admin secrets, the deployment script, seeding
and the rollback path.

## Requirements

### Requirement: Persistent layer storage outside the app lifecycle

Layer data in Azure SHALL live on an Azure Files share in a Storage Account inside a dedicated resource group, separate from the resource group that holds the Container Apps. That resource group SHALL carry a `CanNotDelete` lock. Share soft delete SHALL be enabled with a retention of at least 14 days, and the share SHALL have daily snapshots kept for at least 30 days. The Storage Account SHALL require TLS 1.2 or later and SHALL disable public blob access.

#### Scenario: Destroying the app environment keeps layers

- **WHEN** an operator runs `./azure/deploy.sh destroy`
- **THEN** the storage resource group, the share, and all layers remain intact

#### Scenario: Accidental deletion is recoverable

- **WHEN** a layer file is deleted or corrupted on the share
- **THEN** it can be restored from a share snapshot taken within the retention period

### Requirement: Share mounted into the API container

The API Container App SHALL mount the share read-write at `/mnt/maps`, with mount options that give the API's non-root user (fixed uid/gid 10001) read and write access, and SHALL set `MAPS_ROOT=/mnt/maps`. The API container image SHALL run as uid/gid 10001. The API SHALL be pinned to a single replica (`minReplicas: 1`, `maxReplicas: 1`).

#### Scenario: New revision keeps layers

- **WHEN** a new API image is deployed and a new revision starts
- **THEN** `GET /maps` returns the same layers as before the release, including layers created through the admin

#### Scenario: Write access for the app user

- **WHEN** the API is running with the mount
- **THEN** `/health` reports the maps root as `/mnt/maps` and writable

### Requirement: Admin secrets configured as Container App secrets

`ADMIN_PASSKEY_HASH` and `ADMIN_SESSION_SECRET` SHALL be stored as Container App secrets and exposed to the API through secret references. `ADMIN_ALLOWED_ORIGIN` SHALL be set to the frontend's URL. The plaintext passkey SHALL NOT be stored in Azure or in any repository file.

#### Scenario: Secrets not visible as plain env

- **WHEN** an operator inspects the API Container App configuration
- **THEN** the admin hash and the session secret appear as secret references, not literal values

### Requirement: Deployment script provisions and verifies storage

`azure/deploy.sh` SHALL idempotently create or update the storage resource group, its lock, the Storage Account, the share, its soft-delete and backup settings, and the Container Apps environment storage definition. It SHALL deploy the API with the volume mount, the environment variables, and the secrets from a single rendered app definition (`azure/render_api_app.py`, applied with `az rest --method put`), and SHALL refuse to mount a share that has no `index.json`. After deploying, it SHALL fail if `/health` does not report a writable maps root at `/mnt/maps`. The `destroy` command SHALL NOT delete the storage resource group.

#### Scenario: Re-running deploy

- **WHEN** `./azure/deploy.sh` runs against an environment where storage already exists
- **THEN** it completes without recreating the share or losing data

#### Scenario: Unseeded share

- **WHEN** a deploy would mount a share that has no `index.json`
- **THEN** the script stops before changing the API, with instructions to seed the share

#### Scenario: Mount missing after deploy

- **WHEN** a deploy results in an API revision without the mount
- **THEN** the script's health verification fails with an explicit error

### Requirement: Seeding existing layers

The project SHALL provide a seed command that takes the Git-tracked `app/maps` as source and a target directory. It SHALL run every existing raster through the same validation, COG conversion, and pixel-equality verification as admin ingestion, and SHALL write each raster as `<stem>-v1.tif`, copy the metadata, and write an index with every layer `enabled: true` and `version: 1`. The seeded share SHALL be verified by comparing analysis results for a fixed sample of farms against the pre-migration deployment, which SHALL be identical.

#### Scenario: Seed the six current layers

- **WHEN** the seed command runs on the current `app/maps`
- **THEN** the target contains 6 COG rasters pixel-identical to the originals, their en/es metadata, and an index listing ids 0–5 as enabled at version 1

#### Scenario: Analysis parity after migration

- **WHEN** the same farm sample is analyzed on the old deployment and on the share-backed deployment
- **THEN** every deforestation ratio is identical

### Requirement: Rollback path while Git layers exist

Until the follow-up change removes layers from Git, removing `MAPS_ROOT` (or the mount) from the API configuration SHALL make the API serve the layers baked into the image again, without code changes.

#### Scenario: Roll back storage

- **WHEN** an operator deploys a revision without `MAPS_ROOT`
- **THEN** the API serves the Git-tracked layers from the image and the admin changes remain untouched on the share

