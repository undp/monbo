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

`POST /admin/layers` SHALL create a layer in the country of the admin's session, from the index fields and the en/es attributes and considerations. The new layer SHALL receive `id = max(ids of the session's country) + 1`, with disabled layers counted, and SHALL start with `enabled: false`, no raster and `version: 0`, so that its first raster is version 1. Metadata files SHALL be named `layer-<id>.json` and `layer-<id>.md` inside that country's folder. `name` and `alias` SHALL be required in both `en` and `es`. The other attribute fields and the considerations SHALL be optional. The request SHALL be rejected with 422 when `baseline` > `compared_against` or when `pixel_size` ≤ 0. The request SHALL NOT accept a list of countries.

#### Scenario: Successful creation

- **WHEN** a CO admin posts valid fields and CO's highest id is 2
- **THEN** a layer with id 3, `enabled: false`, `version: 0` and no raster is created under `CO/`, and `GET /maps` does not list it

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

`PUT /admin/layers/{id}` SHALL replace a layer's editable index fields and its en/es attributes and considerations, using the same validation as creation. If the layer has a raster, changing `pixel_size` SHALL be rejected with 409 when its area differs from the raster's cell area by more than 5% at any latitude of the raster. It SHALL write to the layer's existing metadata filenames in its country's folder. It SHALL NOT change `id`, `raster_filename`, `version`, `enabled`, or the layer's country. Ids that are unknown or that belong to another country SHALL return 404.

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

### Requirement: Admin UI

The frontend SHALL provide admin pages under `/[locale]/admin`:

- a login page that asks only for the passkey;
- a layers list showing name, alias, id, version, enabled state, and raster presence, with an enable/disable control;
- a create/edit form for the index fields, with en/es tabs for attributes and considerations and a rendered markdown preview of the considerations, and with no countries field; each tab labels its fields in the tab's language, and an info button next to the texts section opens an example of a filled-in layer;
- a raster section on the edit page that guides the upload in steps (see "Raster upload in steps").

Every admin page SHALL show the name of the country the session administers. On the admin pages the header SHALL show only the language selector and, once logged in, the administered country's name as plain text; it SHALL NOT show the public navigation or the country selector. All UI text SHALL be translated in `en` and `es`. The admin pages SHALL NOT be linked from the public home page or header.

#### Scenario: Create and publish a layer from the UI

- **WHEN** a CO admin logs in, creates a layer, uploads a valid binary raster, waits for it to be validated, and publishes the layer from the raster section
- **THEN** the layer appears in the public map selection for Colombia only, with its metadata and tiles

#### Scenario: Country shown

- **WHEN** an admin logs in with EC's passkey
- **THEN** the admin pages and the header show "Ecuador" as the administered country

#### Scenario: Language switch

- **WHEN** an admin switches the UI language to `es`
- **THEN** every admin label, message, and validation error is shown in Spanish, except the fields of the English tab, which stay in English

#### Scenario: Not discoverable from public pages

- **WHEN** a visitor browses the home page and header
- **THEN** there is no link to the admin pages

### Requirement: Raster upload in steps

The raster section SHALL show a step indicator that is always visible, above the current state:
- 1 "Select the file";
- 2 "Upload and validate";
- 3 "Publish the layer", only when the layer was not published when the section opened or when the admin chose to replace the raster.

A layer that is already published SHALL show two steps. Each step SHALL show whether it is pending, active or done, with a subtitle that reflects the state (for example the file name, "In progress…", "Validated").

The section SHALL go through these states:
- **No file**: a drop zone that accepts `.tif`/`.tiff` by dropping or through a "Select file" button, with the accepted format described.
- **File chosen**: the file's name and size, a "Change file" action, the optional nodata field, and a single "Upload and validate" button. No disabled upload button SHALL be shown before a file is chosen.
- **Processing**:
  - the file row with the current phase and, when measurable, a percentage (the upload's, then the validation's);
  - a progress bar, indeterminate while converting;
  - a checklist of phases that ticks each one as it ends: uploading the file, validating pixels (values 0 and 1), converting to an optimized GeoTIFF;
  - a note that it can take a few minutes, and a "Cancel" button.
- **Ready to publish**, only with three steps: the raster is active and the layer is not published. A "Publish layer" button enables the layer.
- **Done**: which file the layer now uses, and a "Replace raster" action that goes back to "No file".

A failed upload or ingestion SHALL return to "File chosen", keeping the file and the nodata value and showing the error in the user's language. "Cancel" SHALL return to "No file" without changing the layer's raster: while uploading it aborts the request, and while processing it cancels the job. When the API answers that activation has already begun, the section SHALL show the outcome of the job instead. The section SHALL NOT show the raster report or the ingestion warnings.

When the section opens on a layer that has a raster but is not published, it SHALL start in "Ready to publish", with "Replace raster" also available.

#### Scenario: New layer, upload and publish

- **WHEN** an admin opens a new layer without a raster, chooses a valid `.tif` and presses "Upload and validate"
- **THEN** the indicator shows three steps, the checklist ticks uploading, validating and converting, and the section ends in "Ready to publish". After "Publish layer", all three steps are done and the layer is enabled

#### Scenario: Replacing the raster of a published layer

- **WHEN** an admin opens a published layer and uploads a valid raster
- **THEN** the indicator shows two steps, and the section ends in "Done", naming the new file, without offering to publish

#### Scenario: Invalid raster

- **WHEN** the uploaded raster contains values other than 0 and 1
- **THEN** the section returns to "File chosen" with the same file and shows the translated error listing the offending values

#### Scenario: Cancel while validating

- **WHEN** an admin presses "Cancel" while the job is validating
- **THEN** the section returns to "No file", the job ends `cancelled`, and the layer keeps its previous raster

#### Scenario: Unpublished layer with a raster

- **WHEN** an admin opens a layer that has a raster but is not published
- **THEN** the section starts in "Ready to publish", with steps 1 and 2 done and a "Replace raster" action

### Requirement: Admin contracts generated from the API

The admin request and response models SHALL be defined as Pydantic models in the API, including the ingestion job and the upload and cancel responses, and SHALL be declared as the routes' response models. The frontend's admin types SHALL be generated from the API's OpenAPI (`api-contracts`), never written by hand. The public `MapData` type SHALL expose `version` and `pixelSize`, so the frontend can invalidate analysis results when a raster or its calculation metadata changes.

#### Scenario: Contract parity

- **WHEN** a field is added to or removed from an admin Pydantic model and the contracts are regenerated
- **THEN** the frontend's admin type changes accordingly with no hand edit, and the compiler flags any code that relied on the old shape

#### Scenario: Ingestion job typed from the API

- **WHEN** the frontend polls `GET /admin/jobs/{jobId}`
- **THEN** the response's type comes from the API's `IngestionJob` model

