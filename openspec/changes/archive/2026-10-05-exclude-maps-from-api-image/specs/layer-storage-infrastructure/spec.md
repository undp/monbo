## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Rollback path while Git layers exist

**Reason**: The API image no longer contains the Git-tracked layers, so removing `MAPS_ROOT` or the mount no longer falls back to them. Keeping that mode would mean shipping 511 MB of unused rasters in every image and keeping a second, storage-less deployment mode that later infrastructure (Terraform, deployment from CI) would also have to support.

**Migration**: Roll back layer data by restoring the share from a snapshot or backup (soft delete 14 days, daily snapshots 30 days), or rebuild it from Git with `./azure/deploy.sh seed`. To go back to an earlier release that read the flat layout, restore the share from a snapshot taken before the per-country seed and deploy that release with its own `deploy.sh`. Those older images still contain their layers.
