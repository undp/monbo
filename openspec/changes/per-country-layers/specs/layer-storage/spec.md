## MODIFIED Requirements

### Requirement: Configurable layer storage root

The API SHALL resolve the country registry, the layer indexes, the per-language metadata, and the rasters under a single root directory configured by the `MAPS_ROOT` environment variable. When `MAPS_ROOT` is unset it defaults to `app/maps`. In the per-country layout, the root SHALL contain `countries.json` and one folder per country named after its ISO 3166-1 alpha-2 code. Each country folder SHALL contain `index.json`, `metadata/attributes/<lang>/`, `metadata/considerations/<lang>/`, and `layers/rasters/`. All reads and writes of layer data SHALL go through a single storage module. No other module SHALL build layer paths itself.

#### Scenario: Default root preserves current behavior

- **WHEN** the API starts without `MAPS_ROOT`
- **THEN** `GET /maps`, analysis, tiles, and image generation read from `app/maps` exactly as before this change

#### Scenario: Custom root

- **WHEN** the API starts with `MAPS_ROOT=/mnt/maps/v2`
- **THEN** every layer read and write uses files under `/mnt/maps/v2`, and files under `app/maps` are ignored

#### Scenario: Country folder layout

- **WHEN** the root uses the per-country layout and CO has a layer with raster `ideam-v1.tif`
- **THEN** the raster is read from `CO/layers/rasters/ideam-v1.tif` and its Spanish attributes from `CO/metadata/attributes/es/`

#### Scenario: Health reports the storage root

- **WHEN** a client calls `GET /health`
- **THEN** the response includes the resolved maps root and whether it is writable by the API process

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
- **THEN** the response lists only CR's enabled layers (GFW, TMF, and MOCUPP), each with `availableCountriesCodes: ["CR"]`

#### Scenario: Unknown country

- **WHEN** a client calls `GET /maps?country=PE` and PE is not registered
- **THEN** the response is 200 with an empty list

### Requirement: Layers resolvable by id regardless of enabled state

Deforestation analysis, tile serving, and image generation SHALL resolve a layer by id alone, whichever country it belongs to and whether the layer or its country is enabled or disabled.

#### Scenario: Analysis on a disabled layer

- **WHEN** a client posts an analysis request that includes the id of a disabled layer
- **THEN** the API computes results for that layer as it would for an enabled one

#### Scenario: Tiles of a copied layer

- **WHEN** a client requests `/deforestation_analysis/tiles/6/dynamic/8/75/120.png` and id 6 is CO's copy of GFW
- **THEN** the tile is rendered from `CO/layers/rasters/`

## ADDED Requirements

### Requirement: Layer ids are unique across countries

Each layer id SHALL be unique across all countries. A new layer SHALL receive `max(ids of every country, disabled layers included) + 1`, and ids SHALL never be reused. Two concurrent creations SHALL NOT receive the same id.

#### Scenario: Id after the migration

- **WHEN** the highest id in any country is 9 and CO's admin creates a layer
- **THEN** the new layer gets id 10, even if CO's own highest id is 8

### Requirement: Legacy flat layout served read-only

When the root contains a top-level `index.json` and no `countries.json`, the API SHALL serve it as a legacy flat layout:

- `GET /maps` SHALL filter by each entry's `available_countries_codes` when `country` is given;
- `GET /countries` SHALL return the union of the country codes of the enabled layers;
- lookup by id SHALL work as before;
- the admin routes SHALL NOT be registered, and a startup warning SHALL say why.

A root that contains both files, or neither, SHALL make the API fail at startup with an explicit error.

#### Scenario: Local development with the Git-tracked layers

- **WHEN** the API starts with `MAPS_ROOT` unset and `ADMIN_SESSION_SECRET` set
- **THEN** `GET /maps?country=CO` returns GFW, TMF, and IDEAM, `GET /countries` returns CO, CR, and EC, `/admin/*` answers 404, and a startup warning explains that the admin needs a per-country root

#### Scenario: Ambiguous root

- **WHEN** the root contains both `index.json` and `countries.json`
- **THEN** the API refuses to start and names both files in the error
