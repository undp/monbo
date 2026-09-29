## MODIFIED Requirements

### Requirement: Share mounted into the API container

The API Container App SHALL mount the share read-write at `/mnt/maps`, with mount options that give the API's non-root user (fixed uid/gid 10001) read and write access. It SHALL set `MAPS_ROOT=/mnt/maps/v2`, the per-country layout on that share. The API container image SHALL run as uid/gid 10001. The API SHALL be pinned to a single replica (`minReplicas: 1`, `maxReplicas: 1`).

#### Scenario: New revision keeps layers

- **WHEN** a new API image is deployed and a new revision starts
- **THEN** `GET /maps` returns the same layers as before the release, including layers created through the admin

#### Scenario: Write access for the app user

- **WHEN** the API is running with the mount
- **THEN** `/health` reports the maps root as `/mnt/maps/v2` and writable

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

It SHALL deploy the API with the volume mount, the environment variables, and the secrets from a single rendered app definition (`azure/render_api_app.py`, applied with `az rest --method put`). It SHALL refuse to mount a share that has no `v2/countries.json`. After deploying, it SHALL fail if `/health` does not report a writable maps root at `/mnt/maps/v2`. The `destroy` command SHALL NOT delete the storage resource group.

#### Scenario: Re-running deploy

- **WHEN** `./azure/deploy.sh` runs against an environment where storage already exists
- **THEN** it completes without recreating the share or losing data

#### Scenario: Unmigrated share

- **WHEN** a deploy would mount a share that has no `v2/countries.json`
- **THEN** the script stops before changing the API, with instructions to run the per-country migration

#### Scenario: Mount missing after deploy

- **WHEN** a deploy results in an API revision without the mount
- **THEN** the script's health verification fails with an explicit error

### Requirement: Rollback path while Git layers exist

The migration to the per-country layout SHALL leave the flat layout at the share root unchanged. Until a later change removes it, deploying the previous API image with `MAPS_ROOT=/mnt/maps` and its former `ADMIN_PASSKEY_HASH` SHALL restore the previous behavior without code changes or data restores. Removing `MAPS_ROOT` (or the mount) SHALL make the API serve the layers baked into the image.

#### Scenario: Roll back to the flat layout

- **WHEN** an operator deploys the previous API image with `MAPS_ROOT=/mnt/maps`
- **THEN** the API serves the six original layers from the untouched flat layout, and `/mnt/maps/v2` is left intact

#### Scenario: Roll back storage

- **WHEN** an operator deploys a revision without `MAPS_ROOT`
- **THEN** the API serves the Git-tracked layers from the image and the files on the share remain untouched

## ADDED Requirements

### Requirement: Migration to the per-country layout

The project SHALL provide a migration command that reads a flat layout and writes the per-country layout to an empty target directory. The command SHALL:

- give each layer to every country in its `available_countries_codes`, in the listed order: the first country keeps the layer's id, and each additional country gets a copy with a new id taken from a running `max + 1`;
- copy rasters whole, without clipping, and with file copies that don't carry permission bits;
- copy each layer's metadata into its country's folder;
- keep `enabled`, `version`, `raster_filename`, the years, the pixel size, and the references;
- drop `available_countries_codes`;
- register every country with a new passkey, print the passkeys once, and print the id mapping.

It SHALL refuse a non-empty target or a source that is not a flat layout. After the migration, analyzing a fixed sample of farms SHALL give, for each original id, results identical to the flat layout, and each copy SHALL give results identical to its original.

#### Scenario: Migrate the current layers

- **WHEN** the migration runs on the current six layers
- **THEN** EC has ids 0, 1, 2, and 4, CO has 3, 6, and 8, CR has 5, 7, and 9, where 6 and 7 are copies of GFW and 8 and 9 are copies of TMF, and three passkeys are printed

#### Scenario: Analysis parity after migration

- **WHEN** the regression farm sample is analyzed against the flat root and against the migrated root
- **THEN** ids 0–5 give identical ratios in both, and ids 6–9 give ratios identical to ids 0 or 1

#### Scenario: Target not empty

- **WHEN** the migration's target directory already contains files
- **THEN** the command fails and writes nothing

### Requirement: Country commands in the deployment script

`azure/deploy.sh countries <add|list|rotate|disable|enable> [CC]` SHALL run the country registry command against the share's `v2/` layout without redeploying or restarting the API. It SHALL use a temporary local copy and upload only what changed. It SHALL abort without uploading if `countries.json` changed on the share while the command was running.

#### Scenario: Add a country in Azure

- **WHEN** an operator runs `./azure/deploy.sh countries add PE`
- **THEN** `v2/PE/` and the updated `v2/countries.json` exist on the share, the passkey is printed once, and PE's admin can log in without an API restart

#### Scenario: Concurrent registry edit

- **WHEN** the share's `countries.json` changes between the command's download and its upload
- **THEN** the command aborts without uploading and asks the operator to retry
