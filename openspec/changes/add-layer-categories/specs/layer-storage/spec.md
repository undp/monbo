## MODIFIED Requirements

### Requirement: Configurable layer storage root

The API SHALL resolve the country registry, the layer indexes, the category files, the per-language metadata, and the rasters under a single root directory configured by the `MAPS_ROOT` environment variable. When `MAPS_ROOT` is unset it defaults to `app/maps`. In the per-country layout, the root SHALL contain `countries.json` and one folder per country named after its ISO 3166-1 alpha-2 code. Each country folder SHALL contain `index.json`, `metadata/attributes/<lang>/`, `metadata/considerations/<lang>/`, and `layers/rasters/`, and MAY contain `categories.json`. All reads and writes of layer data SHALL go through a single storage module. No other module SHALL build layer paths itself.

#### Scenario: Default root preserves current behavior

- **WHEN** the API starts without `MAPS_ROOT`
- **THEN** `GET /maps`, analysis, tiles, and image generation read from `app/maps` exactly as before this change

#### Scenario: Custom root

- **WHEN** the API starts with `MAPS_ROOT=/mnt/maps`
- **THEN** every layer read and write uses files under `/mnt/maps`, and files under `app/maps` are ignored

#### Scenario: Country folder layout

- **WHEN** the root uses the per-country layout and CO has a layer with raster `ideam-v1.tif`
- **THEN** the raster is read from `CO/layers/rasters/ideam-v1.tif`, its Spanish attributes from `CO/metadata/attributes/es/`, and CO's categories from `CO/categories.json`

#### Scenario: Health reports the storage root

- **WHEN** a client calls `GET /health`
- **THEN** the response includes the resolved maps root and whether it is writable by the API process

### Requirement: Backward-compatible index entries

Each index entry SHALL support the optional fields `enabled` (boolean), `version` (non-negative integer: 0 for a layer that has never had a raster), and `category_id` (the id of a category of the layer's country). Entries without `enabled` SHALL be treated as enabled. Entries without `version` SHALL be treated as version 1. Entries without `category_id` SHALL belong to the `deforestation` category. `baseline` and `compared_against` MAY be missing or `null`, for layers of categories that are not temporal, and SHALL then be read as `null`. Existing index files SHALL load without migration.

#### Scenario: Legacy index loads

- **WHEN** `index.json` contains entries without `enabled`, `version`, or `category_id`
- **THEN** those layers are treated as enabled with version 1, in the `deforestation` category

#### Scenario: Layer without years

- **WHEN** an entry has `baseline: null` and no `compared_against` key
- **THEN** `GET /maps` lists it with `baseline: null` and `comparedAgainst: null`

### Requirement: Atomic index and metadata writes

Every write to `index.json`, to `categories.json`, or to a metadata file SHALL be atomic: the content is written to a temporary file in the same directory, flushed, and then renamed over the target. All reads and writes of the index, the category files, and the metadata files SHALL be serialized within the API process by a single lock, so no read handle is open while a rename replaces the file. If the rename fails with a permission error, the writer SHALL retry and SHALL keep the temporary file until the target's contents match it. A reader SHALL never observe a partially written file, and a failed or retried write SHALL never leave the index or the category file missing. The storage code SHALL NOT change file permissions on the maps root, and SHALL copy files without copying permission bits.

#### Scenario: Concurrent read during write

- **WHEN** the index is being updated while `GET /maps` is served
- **THEN** the request sees either the complete previous index or the complete new one, never a truncated or invalid file

#### Scenario: Rename rejected by the file share

- **WHEN** the first rename of the temporary index over `index.json` fails with a permission error
- **THEN** the write is retried, the new index ends up in place, and at no point after the write returns is `index.json` missing

#### Scenario: Category file written

- **WHEN** a country's `categories.json` is written while `GET /categories` is served for that country
- **THEN** the request sees either the complete previous categories or the complete new ones

#### Scenario: Mount without chmod support

- **WHEN** the maps root is an Azure Files mount where `chmod` is not permitted
- **THEN** creating, editing, and ingesting layers succeeds

### Requirement: Public listing returns enabled layers with version

`GET /maps` SHALL return only enabled layers whose category resolves and is enabled. It SHALL accept an optional `country` query parameter. When the parameter is given, it SHALL return only that country's layers, and it SHALL return an empty list for a country that is unknown or disabled. When the parameter is omitted, it SHALL return the enabled layers of every enabled country. Each returned layer SHALL include its `version`, `availableCountriesCodes`, and `categoryId`. In the per-country layout, `availableCountriesCodes` SHALL contain exactly the layer's country.

#### Scenario: Disabled layer hidden from listing

- **WHEN** layer 4 is disabled and a client calls `GET /maps`
- **THEN** layer 4 is not in the response

#### Scenario: Layer of a disabled category hidden from listing

- **WHEN** CO's layer 3 is enabled, its category `frontier` is disabled, and a client calls `GET /maps?country=CO`
- **THEN** layer 3 is not in the response, and it still resolves by id for analysis and tiles

#### Scenario: Version exposed

- **WHEN** a client calls `GET /maps`
- **THEN** each layer object contains an integer `version`

#### Scenario: Category exposed

- **WHEN** a client calls `GET /maps?country=CO` and CO's layers have no `category_id`
- **THEN** each layer object contains `categoryId: "deforestation"`

#### Scenario: Filter by country

- **WHEN** a client calls `GET /maps?country=CR`
- **THEN** the response lists only CR's enabled layers (GFW, TMF, and MOCUPP, ids 0, 1, and 2), each with `availableCountriesCodes: ["CR"]`

#### Scenario: Unknown country

- **WHEN** a client calls `GET /maps?country=PE` and PE is not registered
- **THEN** the response is 200 with an empty list
