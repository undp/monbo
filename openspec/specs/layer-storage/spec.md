# Layer Storage

## Purpose

Define where and how the API stores layers under `MAPS_ROOT`: the per-country layout (a country
registry and one folder per country) and the legacy flat one, layer ids numbered within each
country, the `enabled` and `version` fields, versioned raster filenames and safe concurrent
writes.
## Requirements
### Requirement: Configurable layer storage root

The API SHALL resolve the country registry, the layer indexes, the per-language metadata, and the rasters under a single root directory configured by the `MAPS_ROOT` environment variable. When `MAPS_ROOT` is unset it defaults to `app/maps`. In the per-country layout, the root SHALL contain `countries.json` and one folder per country named after its ISO 3166-1 alpha-2 code. Each country folder SHALL contain `index.json`, `metadata/attributes/<lang>/`, `metadata/considerations/<lang>/`, and `layers/rasters/`. All reads and writes of layer data SHALL go through a single storage module. No other module SHALL build layer paths itself.

#### Scenario: Default root preserves current behavior

- **WHEN** the API starts without `MAPS_ROOT`
- **THEN** `GET /maps`, analysis, tiles, and image generation read from `app/maps` exactly as before this change

#### Scenario: Custom root

- **WHEN** the API starts with `MAPS_ROOT=/mnt/maps`
- **THEN** every layer read and write uses files under `/mnt/maps`, and files under `app/maps` are ignored

#### Scenario: Country folder layout

- **WHEN** the root uses the per-country layout and CO has a layer with raster `ideam-v1.tif`
- **THEN** the raster is read from `CO/layers/rasters/ideam-v1.tif` and its Spanish attributes from `CO/metadata/attributes/es/`

#### Scenario: Health reports the storage root

- **WHEN** a client calls `GET /health`
- **THEN** the response includes the resolved maps root and whether it is writable by the API process

### Requirement: Backward-compatible index entries

Each index entry SHALL support the optional fields `enabled` (boolean) and `version` (non-negative integer: 0 for a layer that has never had a raster). Entries without `enabled` SHALL be treated as enabled. Entries without `version` SHALL be treated as version 1. Existing index files SHALL load without migration.

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

`GET /maps` SHALL return only enabled layers. It SHALL accept an optional `country` query parameter. When the parameter is given, it SHALL return only that country's layers, and it SHALL return an empty list for a country that is unknown or disabled. When the parameter is omitted, it SHALL return the enabled layers of every enabled country. Each returned layer SHALL include its `version` and `availableCountriesCodes`. In the per-country layout, `availableCountriesCodes` SHALL contain exactly the layer's country.

#### Scenario: Disabled layer hidden from listing

- **WHEN** layer 4 is disabled and a client calls `GET /maps`
- **THEN** layer 4 is not in the response

#### Scenario: Version exposed

- **WHEN** a client calls `GET /maps`
- **THEN** each layer object contains an integer `version`

#### Scenario: Filter by country

- **WHEN** a client calls `GET /maps?country=CR`
- **THEN** the response lists only CR's enabled layers (GFW, TMF, and MOCUPP, ids 0, 1, and 2), each with `availableCountriesCodes: ["CR"]`

#### Scenario: Unknown country

- **WHEN** a client calls `GET /maps?country=PE` and PE is not registered
- **THEN** the response is 200 with an empty list

### Requirement: Layers resolvable by id regardless of enabled state

Deforestation analysis, tile serving, and image generation SHALL resolve a layer by its country and its id, whether the layer or its country is enabled or disabled. `POST /deforestation_analysis/analize` and `POST /deforestation_analysis/generate-image` SHALL take the country as `country` in the body. Tiles SHALL be served at `/deforestation_analysis/tiles/{country}/{id}/dynamic/{z}/{x}/{y}.png`. In the per-country layout, a request without a country SHALL be rejected with 422. In the legacy flat layout the country SHALL be optional, and when it is given, the layer SHALL list it.

#### Scenario: Analysis on a disabled layer

- **WHEN** a client posts an analysis request with a country and the id of one of its disabled layers
- **THEN** the API computes results for that layer as it would for an enabled one

#### Scenario: Tiles of a copied layer

- **WHEN** a client requests `/deforestation_analysis/tiles/CO/0/dynamic/8/75/120.png` and CO's layer 0 is its copy of GFW
- **THEN** the tile is rendered from `CO/layers/rasters/`

#### Scenario: Same id in two countries

- **WHEN** a client posts an analysis for `country: "CR"` and `maps: [2]`
- **THEN** the results are those of Costa Rica's layer 2 (MOCUPP), not of Colombia's layer 2 (IDEAM)

#### Scenario: Country missing

- **WHEN** the root uses the per-country layout and a client posts an analysis without `country`
- **THEN** the response is 422

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

### Requirement: Layer ids are numbered within each country

Each country SHALL number its layers from 0. A new layer SHALL receive `max(ids of its country, disabled layers included) + 1`, computed from that country's index only. Ids SHALL never be reused within a country. Two concurrent creations in a country SHALL NOT receive the same id.

#### Scenario: Id after the migration

- **WHEN** CO's highest id is 2 and Ecuador's is 3, and CO's admin creates a layer
- **THEN** the new layer gets id 3 in CO

### Requirement: Legacy flat layout served read-only

When the root contains a top-level `index.json` and no `countries.json`, the API SHALL serve it as a legacy flat layout:

- `GET /maps` SHALL filter by each entry's `available_countries_codes` when `country` is given;
- `GET /countries` SHALL return the union of the country codes of the enabled layers;
- lookup by id SHALL work as before, with the country optional;
- the admin routes SHALL NOT be registered, and a startup warning SHALL say why.

A root that contains both files SHALL make the API fail at startup with an explicit error. A root with neither SHALL be treated as a flat root whose index is missing, as before this change (`GET /maps` answers 500).

#### Scenario: Local development with the Git-tracked layers

- **WHEN** the API starts with `MAPS_ROOT` unset and `ADMIN_SESSION_SECRET` set
- **THEN** `GET /maps?country=CO` returns GFW, TMF, and IDEAM, `GET /countries` returns CO, CR, and EC, `/admin/*` answers 404, and a startup warning explains that the admin needs a per-country root

#### Scenario: Ambiguous root

- **WHEN** the root contains both `index.json` and `countries.json`
- **THEN** the API refuses to start and names both files in the error

### Requirement: API refuses to start without layers

At startup, the API SHALL check through the storage module that the layers root contains either `countries.json` (per-country layout) or `index.json` (flat layout). When it contains neither, including when the root directory does not exist, the API SHALL fail to start, with an error that names the resolved root and explains how to provide layers: mount the share or a layers folder and set `MAPS_ROOT`. The check SHALL run only at startup and SHALL NOT be part of `/health` or `/health/live`.

#### Scenario: Production image without a mounted root

- **WHEN** the API production image is started without `MAPS_ROOT` and without a mounted layers folder
- **THEN** the process exits during startup with an error naming the missing layers root
- **AND** it never answers `/health`

#### Scenario: Local development from the checkout

- **WHEN** the API is started from a checkout without `MAPS_ROOT`
- **THEN** it starts normally and serves the Git-tracked layers in `app/maps`

#### Scenario: Per-country root

- **WHEN** the API starts with `MAPS_ROOT` pointing at a root that holds `countries.json`
- **THEN** it starts normally

#### Scenario: Root emptied after startup

- **WHEN** the layers root loses its files while the API is running
- **THEN** the API keeps running and `/health` keeps its current response

