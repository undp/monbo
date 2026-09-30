# Layer Administration

## Purpose

Define the admin API and UI for managing deforestation layers: listing every layer, creating and
editing a layer's fields and bilingual metadata, and publishing or hiding it.

## Requirements

### Requirement: List all layers for administration

`GET /admin/layers` SHALL return every layer in the index, enabled or disabled. Each entry SHALL include:

- the index fields: `id`, `pixel_size`, `baseline`, `compared_against`, `references`, `available_countries_codes`, `enabled`, `version`, `raster_filename`;
- the attributes and considerations in every supported language (`en`, `es`);
- whether a raster file is currently present.

#### Scenario: Disabled layers included

- **WHEN** an admin calls `GET /admin/layers` while layer 4 is disabled
- **THEN** layer 4 appears in the response with `enabled: false`

### Requirement: Create a layer

`POST /admin/layers` SHALL create a layer from the index fields and the en/es attributes and considerations. The new layer SHALL receive `id = max(existing ids) + 1`, with disabled layers counted, and SHALL start with `enabled: false` and no raster. Metadata files SHALL be named `layer-<id>.json` and `layer-<id>.md`. `name` and `alias` SHALL be required in both `en` and `es`. The other attribute fields and the considerations SHALL be optional. The request SHALL be rejected with 422 when `baseline` > `compared_against`, when `pixel_size` ≤ 0, or when any country code is not a valid ISO 3166-1 alpha-2 code.

#### Scenario: Successful creation

- **WHEN** an admin posts valid fields and the highest existing id is 5
- **THEN** a layer with id 6, `enabled: false`, and no raster is created, and `GET /maps` does not list it

#### Scenario: Ids are never reused

- **WHEN** the highest id belongs to a disabled layer 9 and a new layer is created
- **THEN** the new layer gets id 10

#### Scenario: Invalid years

- **WHEN** an admin posts `baseline: 2023` and `compared_against: 2020`
- **THEN** the response is 422 and nothing is written

#### Scenario: Missing translation

- **WHEN** an admin posts attributes with an `en` name but no `es` name
- **THEN** the response is 422

### Requirement: Edit a layer

`PUT /admin/layers/{id}` SHALL replace a layer's editable index fields and its en/es attributes and considerations, using the same validation as creation. If the layer has a raster, changing `pixel_size` SHALL be rejected with 409 when it differs from the raster's measured nominal pixel size by more than 5%. It SHALL write to the layer's existing metadata filenames. It SHALL NOT change `id`, `raster_filename`, `version`, or `enabled`. Unknown ids SHALL return 404.

#### Scenario: Edit a seeded layer

- **WHEN** an admin updates the `es` considerations of layer 0 (GFW)
- **THEN** `metadata/considerations/es/gfw.md` contains the new text and `GET /maps?language=es` returns it

#### Scenario: Unknown layer

- **WHEN** an admin calls `PUT /admin/layers/999`
- **THEN** the response is 404

#### Scenario: Edit pixel size to disagree with the raster

- **WHEN** an admin changes a 30 m raster's layer pixel size to 10 m
- **THEN** the response is 409 and neither the index nor metadata is changed

### Requirement: Enable and disable layers

`PATCH /admin/layers/{id}` with `{ "enabled": true | false }` SHALL change the layer's visibility in the public listing. Enabling a layer that has no raster file SHALL fail with 409. There SHALL be no endpoint that hard-deletes a layer.

#### Scenario: Disable a layer

- **WHEN** an admin disables layer 2
- **THEN** `GET /maps` no longer lists layer 2, and analysis by id 2 still works

#### Scenario: Enable without raster

- **WHEN** an admin enables a newly created layer that has not ingested a raster
- **THEN** the response is 409 and the layer stays disabled

### Requirement: Contracts mirrored between API and frontend

The admin request and response models SHALL be defined as Pydantic models in the API and mirrored as TypeScript interfaces in the frontend, with the same field names and optionality. The public `MapData` interface SHALL expose `version` and `pixelSize`, so the frontend can invalidate analysis results when a raster or its calculation metadata changes.

#### Scenario: Contract parity

- **WHEN** a field is added to or removed from an admin Pydantic model
- **THEN** the corresponding TypeScript interface is updated in the same change

### Requirement: Admin UI

The frontend SHALL provide admin pages under `/[locale]/admin`:

- a login page;
- a layers list showing name, alias, id, version, enabled state, and raster presence, with an enable/disable control;
- a create/edit form for the index fields, with en/es tabs for attributes and considerations and a rendered markdown preview of the considerations;
- a raster upload area on the edit page that shows upload progress and then the ingestion job status and report.

All UI text SHALL be translated in `en` and `es`. The admin pages SHALL NOT be linked from the public home page or header.

#### Scenario: Create and publish a layer from the UI

- **WHEN** an admin logs in, creates a layer, uploads a valid binary raster, waits for the job to succeed, and enables the layer
- **THEN** the layer appears in the public map selection with its metadata and tiles

#### Scenario: Language switch

- **WHEN** an admin switches the UI language to `es`
- **THEN** every admin label, message, and validation error is shown in Spanish

#### Scenario: Not discoverable from public pages

- **WHEN** a visitor browses the home page and header
- **THEN** there is no link to the admin pages
