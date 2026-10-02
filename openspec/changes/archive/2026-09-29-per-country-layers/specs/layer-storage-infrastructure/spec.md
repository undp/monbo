## MODIFIED Requirements

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

It SHALL deploy the API with the volume mount, the environment variables, and the secrets from a single rendered app definition (`azure/render_api_app.py`, applied with `az rest --method put`). It SHALL refuse to mount a share that has no `countries.json`. After deploying, it SHALL fail if `/health` does not report a writable maps root at `/mnt/maps`. The `destroy` command SHALL NOT delete the storage resource group.

#### Scenario: Re-running deploy

- **WHEN** `./azure/deploy.sh` runs against an environment where storage already exists
- **THEN** it completes without recreating the share or losing data

#### Scenario: Unseeded share

- **WHEN** a deploy would mount a share that has no `countries.json`
- **THEN** the script stops before changing the API, with instructions to run `./azure/deploy.sh seed`

#### Scenario: Mount missing after deploy

- **WHEN** a deploy results in an API revision without the mount
- **THEN** the script's health verification fails with an explicit error

### Requirement: Rollback path while Git layers exist

Until a later change removes the layers from Git, removing `MAPS_ROOT` (or the mount) SHALL make the API serve the layers baked into the image, read-only, without code changes. Going back to a release from before the per-country layout SHALL require restoring the share from a snapshot taken before it was seeded in the per-country layout.

#### Scenario: Roll back storage

- **WHEN** an operator deploys a revision without `MAPS_ROOT`
- **THEN** the API serves the Git-tracked layers from the image, the admin is off, and the files on the share remain untouched

#### Scenario: Roll back to an earlier release

- **WHEN** an operator restores the share from a snapshot taken before the seed and deploys an earlier release with its own `deploy.sh`
- **THEN** that release serves the flat layout it expects

## ADDED Requirements

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
