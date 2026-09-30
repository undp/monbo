# Layer Administration

## Purpose

Define the admin API and UI for managing a country's deforestation layers: listing them,
creating and editing a layer's fields and bilingual metadata, and publishing or hiding it, always
within the country of the admin's session.

## Requirements
### Requirement: List all layers for administration

`GET /admin/layers` SHALL return every layer, enabled or disabled, of the country in the admin's session, and no layer of any other country. Each entry SHALL include:

- the index fields: `id`, `pixel_size`, `baseline`, `compared_against`, `references`, `enabled`, `version`, `raster_filename`;
- the attributes and considerations in every supported language (`en`, `es`);
- whether a raster file is currently present.

#### Scenario: Disabled layers included

- **WHEN** a CO admin calls `GET /admin/layers` while CO's layer 2 is disabled
- **THEN** layer 2 appears in the response with `enabled: false`

#### Scenario: Other countries' layers excluded

- **WHEN** a CR admin calls `GET /admin/layers`
- **THEN** the response contains CR's layers (GFW, TMF, and MOCUPP) and no layer of CO or EC

### Requirement: Create a layer

`POST /admin/layers` SHALL create a layer in the country of the admin's session, from the index fields and the en/es attributes and considerations. The new layer SHALL receive `id = max(ids of the session's country) + 1`, with disabled layers counted, and SHALL start with `enabled: false` and no raster. Metadata files SHALL be named `layer-<id>.json` and `layer-<id>.md` inside that country's folder. `name` and `alias` SHALL be required in both `en` and `es`. The other attribute fields and the considerations SHALL be optional. The request SHALL be rejected with 422 when `baseline` > `compared_against` or when `pixel_size` ≤ 0. The request SHALL NOT accept a list of countries.

#### Scenario: Successful creation

- **WHEN** a CO admin posts valid fields and CO's highest id is 2
- **THEN** a layer with id 3, `enabled: false`, and no raster is created under `CO/`, and `GET /maps` does not list it

#### Scenario: Ids are never reused

- **WHEN** CO's highest id belongs to a disabled layer 9 and a CO admin creates a layer
- **THEN** the new layer gets id 10, whatever the ids of other countries

#### Scenario: Invalid years

- **WHEN** an admin posts `baseline: 2023` and `compared_against: 2020`
- **THEN** the response is 422 and nothing is written

#### Scenario: Missing translation

- **WHEN** an admin posts attributes with an `en` name but no `es` name
- **THEN** the response is 422

### Requirement: Edit a layer

`PUT /admin/layers/{id}` SHALL replace a layer's editable index fields and its en/es attributes and considerations, using the same validation as creation. If the layer has a raster, changing `pixel_size` SHALL be rejected with 409 when it differs from the raster's measured nominal pixel size by more than 5%. It SHALL write to the layer's existing metadata filenames in its country's folder. It SHALL NOT change `id`, `raster_filename`, `version`, `enabled`, or the layer's country. Ids that are unknown or that belong to another country SHALL return 404.

#### Scenario: Edit a copied layer

- **WHEN** a CO admin updates the `es` considerations of layer 0 (CO's copy of GFW)
- **THEN** `CO/metadata/considerations/es/gfw.md` contains the new text, `GET /maps?country=CO&language=es` returns it, and EC's and CR's GFW are unchanged

#### Scenario: Unknown layer

- **WHEN** an admin calls `PUT /admin/layers/999`
- **THEN** the response is 404

#### Scenario: Another country's layer

- **WHEN** a CO admin calls `PUT /admin/layers/3` and only EC has a layer 3
- **THEN** the response is 404 and nothing is written

#### Scenario: Edit pixel size to disagree with the raster

- **WHEN** an admin changes a 30 m raster's layer pixel size to 10 m
- **THEN** the response is 409 and neither the index nor metadata is changed

### Requirement: Enable and disable layers

`PATCH /admin/layers/{id}` with `{ "enabled": true | false }` SHALL change the layer's visibility in the public listing. Enabling a layer that has no raster file SHALL fail with 409. Ids that are unknown or that belong to another country SHALL return 404. There SHALL be no endpoint that hard-deletes a layer.

#### Scenario: Disable a layer

- **WHEN** an EC admin disables layer 2
- **THEN** `GET /maps?country=EC` no longer lists layer 2, and an analysis of EC's layer 2 still works

#### Scenario: Enable without raster

- **WHEN** an admin enables a newly created layer that has not ingested a raster
- **THEN** the response is 409 and the layer stays disabled

#### Scenario: Another country's layer

- **WHEN** a CR admin calls `PATCH /admin/layers/3` and only EC has a layer 3
- **THEN** the response is 404 and EC's layer 3 is unchanged

### Requirement: Contracts mirrored between API and frontend

The admin request and response models SHALL be defined as Pydantic models in the API and mirrored as TypeScript interfaces in the frontend, with the same field names and optionality. The public `MapData` interface SHALL expose `version` and `pixelSize`, so the frontend can invalidate analysis results when a raster or its calculation metadata changes.

#### Scenario: Contract parity

- **WHEN** a field is added to or removed from an admin Pydantic model
- **THEN** the corresponding TypeScript interface is updated in the same change

### Requirement: Admin UI

The frontend SHALL provide admin pages under `/[locale]/admin`:

- a login page that asks only for the passkey;
- a layers list showing name, alias, id, version, enabled state, and raster presence, with an enable/disable control;
- a create/edit form for the index fields, with en/es tabs for attributes and considerations and a rendered markdown preview of the considerations, and with no countries field;
- a raster upload area on the edit page that shows upload progress and then the ingestion job status and report.

Every admin page SHALL show the name of the country the session administers. All UI text SHALL be translated in `en` and `es`. The admin pages SHALL NOT be linked from the public home page or header.

#### Scenario: Create and publish a layer from the UI

- **WHEN** a CO admin logs in, creates a layer, uploads a valid binary raster, waits for the job to succeed, and enables the layer
- **THEN** the layer appears in the public map selection for Colombia only, with its metadata and tiles

#### Scenario: Country shown

- **WHEN** an admin logs in with EC's passkey
- **THEN** the admin pages show "Ecuador" as the administered country

#### Scenario: Language switch

- **WHEN** an admin switches the UI language to `es`
- **THEN** every admin label, message, and validation error is shown in Spanish

#### Scenario: Not discoverable from public pages

- **WHEN** a visitor browses the home page and header
- **THEN** there is no link to the admin pages
