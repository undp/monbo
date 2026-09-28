# Layer Storage

## Purpose

Define where and how the API stores layers (the index, rasters and metadata under `MAPS_ROOT`),
including the `enabled` and `version` fields, versioned raster filenames and safe concurrent writes.

## Requirements

### Requirement: Configurable layer storage root

The API SHALL resolve the layers index, the per-language metadata, and the rasters under a single root directory configured by the `MAPS_ROOT` environment variable. When `MAPS_ROOT` is unset it defaults to `app/maps`. The layout under the root SHALL be `index.json`, `metadata/attributes/<lang>/`, `metadata/considerations/<lang>/`, and `layers/rasters/`. All reads and writes of layer data SHALL go through a single storage module. No other module SHALL build layer paths itself.

#### Scenario: Default root preserves current behavior

- **WHEN** the API starts without `MAPS_ROOT`
- **THEN** `GET /maps`, analysis, tiles, and image generation read from `app/maps` exactly as before this change

#### Scenario: Custom root

- **WHEN** the API starts with `MAPS_ROOT=/mnt/maps`
- **THEN** every layer read and write uses files under `/mnt/maps`, and files under `app/maps` are ignored

#### Scenario: Health reports the storage root

- **WHEN** a client calls `GET /health`
- **THEN** the response includes the resolved maps root and whether it is writable by the API process

### Requirement: Backward-compatible index entries

Each index entry SHALL support the optional fields `enabled` (boolean) and `version` (positive integer). Entries without `enabled` SHALL be treated as enabled. Entries without `version` SHALL be treated as version 1. Existing index files SHALL load without migration.

#### Scenario: Legacy index loads

- **WHEN** `index.json` contains entries without `enabled` or `version`
- **THEN** those layers are treated as enabled with version 1

### Requirement: Atomic index and metadata writes

Every write to `index.json` or to a metadata file SHALL be atomic: the content is written to a temporary file in the same directory, flushed, and then renamed over the target. All reads and writes of the index and of the metadata files SHALL be serialized within the API process by a single lock, so no read handle is open while a rename replaces the file. If the rename fails with a permission error, the writer SHALL retry and SHALL keep the temporary file until the target's contents match it. A reader SHALL never observe a partially written file, and a failed or retried write SHALL never leave the index missing. The storage code SHALL NOT change file permissions on the maps root, and SHALL copy files without copying permission bits.

#### Scenario: Concurrent read during write

- **WHEN** the index is being updated while `GET /maps` is served
- **THEN** the request sees either the complete previous index or the complete new one, never a truncated or invalid file

#### Scenario: Rename rejected by the file share

- **WHEN** the first rename of the temporary index over `index.json` fails with a permission error
- **THEN** the write is retried, the new index ends up in place, and at no point after the write returns is `index.json` missing

#### Scenario: Mount without chmod support

- **WHEN** the maps root is an Azure Files mount where `chmod` is not permitted
- **THEN** creating, editing, and ingesting layers succeeds

### Requirement: Versioned raster filenames

A raster SHALL never be overwritten in place. Each successful raster ingestion SHALL store the file under a new name, `<stem>-v<version>.tif`, and SHALL increment the layer's `version`. Previous raster files SHALL be kept.

#### Scenario: Raster replacement creates a new file

- **WHEN** a layer at version 2 with raster `layer-7-v2.tif` successfully ingests a new raster
- **THEN** the layer points to `layer-7-v3.tif`, its version is 3, and `layer-7-v2.tif` still exists

### Requirement: Public listing returns enabled layers with version

`GET /maps` SHALL return only enabled layers. Each returned layer SHALL include its `version`, in addition to the fields returned today.

#### Scenario: Disabled layer hidden from listing

- **WHEN** layer 4 is disabled and a client calls `GET /maps`
- **THEN** layer 4 is not in the response

#### Scenario: Version exposed

- **WHEN** a client calls `GET /maps`
- **THEN** each layer object contains an integer `version`

### Requirement: Layers resolvable by id regardless of enabled state

Deforestation analysis, tile serving, and image generation SHALL resolve a layer by id whether it is enabled or disabled.

#### Scenario: Analysis on a disabled layer

- **WHEN** a client posts an analysis request that includes the id of a disabled layer
- **THEN** the API computes results for that layer as it would for an enabled one

### Requirement: Tile URLs carry the layer version

The frontend SHALL append the layer's `version` as a query parameter to deforestation tile URLs. The API SHALL serve the tile regardless of that parameter.

#### Scenario: New raster invalidates cached tiles

- **WHEN** a layer's version changes from 2 to 3
- **THEN** the frontend requests tiles with `?v=3`, so the browser does not reuse tiles cached for `?v=2`

### Requirement: Warning when admin writes target the repository

When the admin feature is enabled and the resolved maps root is inside the repository's tracked `app/maps` directory, the API SHALL log a warning at startup.

#### Scenario: Local admin against Git-tracked files

- **WHEN** the API starts with the admin enabled and `MAPS_ROOT` unset
- **THEN** a startup warning states that admin writes will modify Git-tracked files

