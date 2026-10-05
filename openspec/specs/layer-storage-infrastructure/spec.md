# Layer Storage Infrastructure

## Purpose

Define the Azure infrastructure that keeps layers across releases: the Azure Files share and its
protection, the mount into the API container (whose image carries no layers), the admin secret,
the deployment script and its seed and countries commands, and the migration to the per-country
layout.
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

The API Container App SHALL mount the share read-write at `/mnt/maps`, with mount options that give the API's non-root user (fixed uid/gid 10001) read and write access. It SHALL set `MAPS_ROOT=/mnt/maps`, where the share holds the per-country layout. The API container image SHALL run as uid/gid 10001. The API SHALL be pinned to a single replica (`minReplicas: 1`, `maxReplicas: 1`).

#### Scenario: New revision keeps layers

- **WHEN** a new API image is deployed and a new revision starts
- **THEN** `GET /maps` returns the same layers as before the release, including layers created through the admin

#### Scenario: Write access for the app user

- **WHEN** the API is running with the mount
- **THEN** `/health` reports the maps root as `/mnt/maps` and writable

### Requirement: Admin secrets configured as Container App secrets

`ADMIN_SESSION_SECRET` SHALL be stored as a Container App secret and exposed to the API through a secret reference. `ADMIN_PASSKEY_HASH` SHALL NOT be configured. The per-country passkey hashes SHALL live only in the country registry on the share. `ADMIN_ALLOWED_ORIGIN` SHALL be set to the frontend's URL. No plaintext passkey SHALL be stored in Azure or in any repository file.

#### Scenario: Secrets not visible as plain env

- **WHEN** an operator inspects the API Container App configuration
- **THEN** the session secret appears as a secret reference, not a literal value, and there is no admin passkey hash

### Requirement: Deployment script provisions and verifies storage

`azure/deploy.sh` SHALL idempotently create or update:

- the storage resource group and its lock;
- the Storage Account and the share;
- the share's soft-delete and backup settings;
- the Container Apps environment storage definition.

It SHALL deploy the API with the volume mount, the environment variables, and the secrets from a single rendered app definition (`azure/render_api_app.py`, applied with `az rest --method put`). It SHALL refuse to mount a share that has no `countries.json`. After deploying, it SHALL fail if `/health` does not report a writable maps root at `/mnt/maps`. The `destroy` command SHALL NOT delete the storage resource group. It SHALL check that the Git-tracked rasters are real files and not Git LFS pointers before seeding. It SHALL NOT require that check to build the API image, which does not contain them.

#### Scenario: Re-running deploy

- **WHEN** `./azure/deploy.sh` runs against an environment where storage already exists
- **THEN** it completes without recreating the share or losing data

#### Scenario: Unseeded share

- **WHEN** a deploy would mount a share that has no `countries.json`
- **THEN** the script stops before changing the API, with instructions to run `./azure/deploy.sh seed`

#### Scenario: Mount missing after deploy

- **WHEN** a deploy results in an API revision without the mount
- **THEN** the script's health verification fails with an explicit error

#### Scenario: Build from a checkout without LFS content

- **WHEN** an operator builds and deploys from a checkout where the rasters are Git LFS pointers
- **THEN** the build and deploy proceed, because the image does not contain the rasters

#### Scenario: Seed from a checkout without LFS content

- **WHEN** an operator runs `./azure/deploy.sh seed` and a raster is a Git LFS pointer
- **THEN** the command stops before touching the share and asks to run `git lfs pull`

### Requirement: Seeding existing layers

The project SHALL provide a seed command that takes the Git-tracked `app/maps` as source and a target directory. It SHALL run every existing raster through the same validation, COG conversion, and pixel-equality verification as admin ingestion, and SHALL write each raster as `<stem>-v1.tif`, copy the metadata, and write an index with every layer `enabled: true` and `version: 1`. The seeded share SHALL be verified by comparing analysis results for a fixed sample of farms against the pre-migration deployment, which SHALL be identical.

#### Scenario: Seed the six current layers

- **WHEN** the seed command runs on the current `app/maps`
- **THEN** the target contains 6 COG rasters pixel-identical to the originals, their en/es metadata, and an index listing ids 0–5 as enabled at version 1

#### Scenario: Analysis parity after migration

- **WHEN** the same farm sample is analyzed on the old deployment and on the share-backed deployment
- **THEN** every deforestation ratio is identical

### Requirement: Migration to the per-country layout

The project SHALL provide a migration command that reads a flat layout and writes the per-country layout to an empty target directory. The command SHALL:

- give each layer to every country in its `available_countries_codes`, each country numbering its layers from 0 in the order of their original ids;
- copy rasters whole, without clipping, and with file copies that don't carry permission bits;
- copy each layer's metadata into its country's folder;
- keep `enabled`, `version`, `raster_filename`, the years, the pixel size, and the references;
- drop `available_countries_codes`;
- register every country with a new passkey, print the passkeys once, and print the id mapping; with `--mapping-out`, write it as `{country: {old id: new id}}`.

It SHALL refuse a non-empty target or a source that is not a flat layout. After the migration, analyzing a fixed sample of farms SHALL give, for every country and new id, results identical to those of its old id on the flat layout. The project SHALL provide that check as `tests.regression.parity --mapping`.

#### Scenario: Migrate the current layers

- **WHEN** the migration runs on the current six layers
- **THEN** GFW is layer 0 and TMF layer 1 in EC, CO, and CR; EC's other layers are 2 and 3, CO's IDEAM is 2, CR's MOCUPP is 2; and three passkeys are printed

#### Scenario: Analysis parity after migration

- **WHEN** the regression farm sample is analyzed against the flat root and, country by country, against the migrated root
- **THEN** every new id gives ratios identical to its old id's, following the migration's id mapping

#### Scenario: Target not empty

- **WHEN** the migration's target directory already contains files
- **THEN** the command fails and writes nothing

### Requirement: Seeding the share in the per-country layout

`azure/deploy.sh seed` SHALL fill the share with the Git-tracked layers in the per-country layout:

- every raster SHALL go through the seed command's validation and COG conversion, and the result through the migration;
- the passkey of every country SHALL be printed once;
- each country's id mapping SHALL be written to a local file (`SEED_MAPPING_OUT`);
- the result SHALL be uploaded to the share's root.

When the share already has files, the command SHALL ask the operator to type the share's name before doing anything, and SHALL delete the share's files only after the new layers are ready locally. If the confirmation or the preparation fails, the share SHALL be unchanged.

#### Scenario: First setup

- **WHEN** an operator runs `./azure/deploy.sh seed` on an empty share
- **THEN** the share has `countries.json` and the `CO/`, `CR/`, and `EC/` folders with their layers, and three passkeys are printed

#### Scenario: Starting an environment over

- **WHEN** an operator runs `./azure/deploy.sh seed` on a share with the flat layout and types the share's name
- **THEN** every previous file is deleted and the share holds only the per-country layout from Git

#### Scenario: Confirmation refused

- **WHEN** the operator types anything other than the share's name
- **THEN** the command stops and the share is unchanged

### Requirement: Country commands in the deployment script

`azure/deploy.sh countries <add|list|rotate|disable|enable> [CC]` SHALL run the country registry command against the share without redeploying or restarting the API. It SHALL use a temporary local copy and upload only what changed. It SHALL abort without uploading if `countries.json` changed on the share while the command was running.

#### Scenario: Add a country in Azure

- **WHEN** an operator runs `./azure/deploy.sh countries add PE`
- **THEN** `PE/` and the updated `countries.json` exist on the share, the passkey is printed once, and PE's admin can log in without an API restart

#### Scenario: Concurrent registry edit

- **WHEN** the share's `countries.json` changes between the command's download and its upload
- **THEN** the command aborts without uploading and asks the operator to retry

### Requirement: API image carries no layers

The API production image SHALL NOT contain any layer data: no rasters, no `index.json`, no `countries.json`, and no metadata. `app/maps/` SHALL be excluded from the API's Docker build context. The layers SHALL remain tracked in Git (Git LFS), so that a clone of the repository has working layers for local development, tests and seeding.

#### Scenario: Image without layers

- **WHEN** the API production image is built from a checkout whose `app/maps/` holds the six Git LFS rasters
- **THEN** the image contains no `app/maps/` directory
- **AND** the build context sent to Docker does not include `app/maps/`

#### Scenario: Clone keeps the layers

- **WHEN** a developer clones the repository and runs `git lfs pull`
- **THEN** `monbo-api/app/maps/` contains the flat layout with its rasters, and the API started locally without `MAPS_ROOT` serves those layers

### Requirement: Deploying the API requires layer storage

The deployment SHALL NOT deploy the API without layer storage. `azure/deploy.sh` SHALL stop, before building or changing anything, when `STORAGE_ACCOUNT_NAME` is empty for a command that deploys the API. Every deployed API revision SHALL mount the share at `/mnt/maps` and set `MAPS_ROOT=/mnt/maps`.

#### Scenario: Configuration without storage

- **WHEN** an operator runs `./azure/deploy.sh` with `STORAGE_ACCOUNT_NAME` empty
- **THEN** the script stops before building images or touching the Container Apps, explaining that the API needs the layer storage

#### Scenario: Every revision mounts the share

- **WHEN** the API is deployed
- **THEN** the rendered app definition has the `maps` volume mounted at `/mnt/maps` and `MAPS_ROOT=/mnt/maps`

