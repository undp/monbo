## ADDED Requirements

### Requirement: List categories for administration

`GET /admin/categories` SHALL return the categories of the country in the admin's session, enabled or not, and no category of any other country. The response SHALL contain `categories`, `readable` and `errors`. `categories` SHALL hold the country's effective categories in the order `GET /categories` uses (the built-in `deforestation` first when it is not stored), each in camelCase with `id`, `name`, `description`, `icon`, `color`, `polarity`, `thresholdPercentage`, `resultLabels`, `temporal`, `enabled`, `layerCount` and `publishedLayerCount`, all always present. `thresholdPercentage` SHALL be the category's own threshold, or `null` when it uses the global one. `layerCount` SHALL count the country's layers whose `category_id` is that id, and `publishedLayerCount` those of them that are enabled. `readable` SHALL be `false` when the country's `categories.json` can't be parsed or read, and `errors` SHALL list the problems of the file (an unreadable file, rejected entries) without any path of the share. A rejected category SHALL NOT be listed.

#### Scenario: Country without stored categories

- **WHEN** a CO admin calls `GET /admin/categories` and CO has no `categories.json` and three enabled layers
- **THEN** the response lists only `deforestation`, with `thresholdPercentage: null`, `enabled: true`, `layerCount: 3` and `publishedLayerCount: 3`, `readable: true` and no errors

#### Scenario: Other countries' categories excluded

- **WHEN** EC has a category `protected_areas_ec` and a CO admin calls `GET /admin/categories`
- **THEN** `protected_areas_ec` is not in the response

#### Scenario: Rejected entry reported

- **WHEN** CO's `categories.json` has a `frontier` entry with `polarity: "inside"`
- **THEN** `frontier` is not listed, `readable` is `true`, and `errors` names the entry and the reason

#### Scenario: Unreadable file reported

- **WHEN** CO's `categories.json` is not valid JSON
- **THEN** the response is 200 with no categories, `readable: false`, and an error saying the file is not valid JSON

### Requirement: Create a category

`POST /admin/categories` SHALL create a category in the country of the admin's session from an `id` and the fields `name`, `description`, `icon`, `color`, `polarity`, `thresholdPercentage` (optional, `null` for the global threshold), `resultLabels` and `temporal`, validated with the rules of the per-country category file. The new category SHALL start enabled and SHALL be added at the end of the country's `categories.json`. When the `id` is already used in the country, by a valid or a rejected entry, or is `deforestation`, the request SHALL be rejected with 409 and nothing SHALL be written, so category ids are never reused. Invalid fields SHALL be rejected with 422. When layers of the country already point at the `id` (for example after a hand edit), the request SHALL be rejected with 400, naming those layers, while any of them is published or has years that don't fit the new `temporal` (a temporal category needs both years, any other none); those layers SHALL become public only by being enabled afterwards. When the country's `categories.json` can't be read, the request SHALL be rejected with 409 and the file SHALL NOT be changed. The request SHALL NOT accept a country.

#### Scenario: Create protected areas

- **WHEN** a CO admin posts `id: "protected_areas"`, `polarity: "avoid"`, `temporal: false`, `thresholdPercentage: 0` and valid texts
- **THEN** the response is 201, `GET /admin/categories` lists it enabled with no layers, and `GET /categories?country=CO` lists it with `thresholdPercentage: 0`

#### Scenario: Taken id

- **WHEN** CO already has a disabled category `frontier` and a CO admin posts `id: "frontier"`
- **THEN** the response is 409 and CO's `categories.json` is unchanged

#### Scenario: Invalid polarity

- **WHEN** an admin posts `polarity: "inside"`
- **THEN** the response is 422 and nothing is written

#### Scenario: Create a category that published layers already point at

- **WHEN** CO's layer 8 is enabled with `category_id: "wetlands"`, CO has no `wetlands` category, and a CO admin posts `id: "wetlands"`
- **THEN** the response is 400 naming layer 8, nothing is written, and `GET /maps?country=CO` still doesn't list layer 8

#### Scenario: Create a category over hidden layers

- **WHEN** CO's hidden layer 8 has `category_id: "wetlands"` and both years, and a CO admin posts `id: "wetlands"` with `temporal: true`
- **THEN** the category is created, layer 8 stays hidden, and enabling it publishes it

#### Scenario: Same id in another country

- **WHEN** EC has `protected_areas` and a CO admin posts `id: "protected_areas"`
- **THEN** the category is created in CO and EC's is unchanged

### Requirement: Edit a category

`PUT /admin/categories/{id}` SHALL replace a category's editable fields (`name`, `description`, `icon`, `color`, `polarity`, `thresholdPercentage`, `resultLabels`, `temporal`) with the same validation as creation. It SHALL NOT change `id` or `enabled`. A change of `polarity` SHALL be rejected with 400 while the category has published layers, and a change of `temporal` SHALL be rejected with 400 while the category has any layer; the message SHALL name the layers involved. Changes to the texts, icon, color and threshold SHALL be allowed at any time. Editing the built-in `deforestation` while it is not stored SHALL store it, first in the file. Editing an id that the file holds as a rejected entry SHALL replace every entry with that id by the new valid one, and SHALL be rejected with 400 while the country has published layers in that category, because the rejected entry's polarity and years can't be read, or when the years of any of its layers don't fit the new `temporal` (a temporal category needs both years, any other none). The repaired entry SHALL keep its stored `enabled` when it is a boolean. The write SHALL keep every other entry of `categories.json` as it was stored, including rejected ones. Ids that are not in the session's country SHALL return 404. When the country's `categories.json` can't be read, the request SHALL be rejected with 409 and the file SHALL NOT be changed.

#### Scenario: Change a threshold

- **WHEN** a CO admin sets `thresholdPercentage: 5` on `deforestation`, which is built in and has published layers
- **THEN** CO's `categories.json` starts with `deforestation` with `threshold_percentage: 5`, and `GET /categories?country=CO` returns it first with `thresholdPercentage: 5`

#### Scenario: Polarity of a category with published layers

- **WHEN** CO's `frontier` has published layer 4 and a CO admin changes its polarity to `avoid`
- **THEN** the response is 400 naming layer 4, and the category is unchanged

#### Scenario: Polarity of a category with only hidden layers

- **WHEN** CO's `frontier` has only the disabled layer 4 and a CO admin changes its polarity
- **THEN** the change is saved

#### Scenario: Temporal of a category with layers

- **WHEN** CO's `protected_areas` has a layer and a CO admin sets `temporal: true`
- **THEN** the response is 400 and the category is unchanged

#### Scenario: Repair a rejected entry

- **WHEN** CO's `categories.json` holds two entries with id `frontier` and an unparseable entry without an id, and a CO admin puts a valid `frontier`
- **THEN** the file holds one valid `frontier` and still holds the entry without an id, and CO's layers in `frontier` are no longer tagged `invalid_category`

#### Scenario: Repair a rejected entry with published layers

- **WHEN** CO's `frontier` entry is rejected and CO's layer 4, in `frontier`, is published
- **THEN** a CO admin's `PUT /admin/categories/frontier` answers 400 naming layer 4, and the file is unchanged

#### Scenario: Repair that doesn't fit its layers' years

- **WHEN** CO's `protected_areas` entry is rejected, CO's hidden layer 6 in it has no years, and a CO admin puts `protected_areas` with `temporal: true`
- **THEN** the response is 400 naming layer 6, and the file is unchanged

#### Scenario: Repair a disabled entry

- **WHEN** CO's `frontier` entry is rejected and stored with `enabled: false`, and a CO admin puts a valid `frontier`
- **THEN** `frontier` is stored valid and still disabled, and `GET /categories?country=CO` doesn't list it

#### Scenario: Another country's category

- **WHEN** a CO admin calls `PUT /admin/categories/protected_areas_ec` and only EC has it
- **THEN** the response is 404 and EC's category is unchanged

### Requirement: Enable and disable categories

`PATCH /admin/categories/{id}` with `{ "enabled": true | false }` SHALL change whether the category and its layers can be public. Disabling or enabling a category that has published layers SHALL be rejected with 400, with a message naming those layers, and nothing SHALL be written: its layers become public only by being enabled with `PATCH /admin/layers/{id}` (a disabled category with published layers only exists after a hand edit). Enabling or disabling the built-in `deforestation` while it is not stored SHALL store it first in the file. A rejected entry SHALL answer 400 until it is repaired with `PUT`. Ids that are not in the session's country SHALL return 404. There SHALL be no endpoint that deletes a category.

#### Scenario: Disable a category with published layers

- **WHEN** CO's `protected_areas` has published layer 5 and a CO admin disables it
- **THEN** the response is 400 naming layer 5, and `protected_areas` stays enabled

#### Scenario: Enable a category with published layers

- **WHEN** CO's `protected_areas` is disabled and a hand edit left its layer 7 enabled, with years, and a CO admin enables `protected_areas`
- **THEN** the response is 400 naming layer 7, `protected_areas` stays disabled, and `GET /maps?country=CO` doesn't list layer 7

#### Scenario: Disable a category without published layers

- **WHEN** CO's `frontier` has only disabled layers and a CO admin disables it
- **THEN** `GET /categories?country=CO` no longer lists `frontier`, and `GET /admin/categories` lists it with `enabled: false`

#### Scenario: Another country's category

- **WHEN** an EC admin calls `PATCH /admin/categories/protected_areas` and only CO has it
- **THEN** the response is 404 and CO's category is unchanged

## MODIFIED Requirements

### Requirement: List all layers for administration

`GET /admin/layers` SHALL return every layer, enabled or disabled, of the country in the admin's session, and no layer of any other country. Each entry SHALL include:

- the index fields: `id`, `pixel_size`, `baseline`, `compared_against`, `references`, `enabled`, `version`, `raster_filename`, `category_id` (`deforestation` when the entry has none);
- `category_issue`: `null` when the layer's category resolves in its country, otherwise `unknown_category`, `invalid_category` or `unreadable_categories`;
- `category_enabled`: whether the layer's category resolves and is enabled;
- `layer_issue`: `null`, or why the layer can't be public even with a usable category: `years_mismatch` when its years don't fit the category's `temporal`, `missing_raster` when it has no raster;
- the attributes and considerations in every supported language (`en`, `es`);
- whether a raster file is currently present.

#### Scenario: Disabled layers included

- **WHEN** a CO admin calls `GET /admin/layers` while CO's layer 2 is disabled
- **THEN** layer 2 appears in the response with `enabled: false`

#### Scenario: Other countries' layers excluded

- **WHEN** a CR admin calls `GET /admin/layers`
- **THEN** the response contains CR's layers (GFW, TMF, and MOCUPP) and no layer of CO or EC

#### Scenario: Layer with a broken category

- **WHEN** CO's layer 3 has `category_id: "frontier"` and CO has no category `frontier`
- **THEN** layer 3 appears with `category_id: "frontier"`, `category_issue: "unknown_category"` and `category_enabled: false`

#### Scenario: Layer that can't be public

- **WHEN** CO's layer 7 is in `deforestation` with only a baseline year, and layer 8 has no raster file
- **THEN** layer 7 appears with `layer_issue: "years_mismatch"` and layer 8 with `layer_issue: "missing_raster"`

#### Scenario: Year that can't be read

- **WHEN** a hand edit leaves CO's layer 7 with `baseline: "2020a"`
- **THEN** `GET /admin/layers` answers 200 and shows layer 7 with `baseline: null` and `layer_issue: "years_mismatch"`

#### Scenario: Legacy layer

- **WHEN** CO's layer 0 has no `category_id` in the index
- **THEN** it appears with `category_id: "deforestation"`, `category_issue: null` and `category_enabled: true`

### Requirement: Create a layer

`POST /admin/layers` SHALL create a layer in the country of the admin's session, from the index fields, its `category_id`, and the en/es attributes and considerations. The new layer SHALL receive `id = max(ids of the session's country) + 1`, with disabled layers counted, and SHALL start with `enabled: false`, no raster and `version: 0`, so that its first raster is version 1. Metadata files SHALL be named `layer-<id>.json` and `layer-<id>.md` inside that country's folder. `name` and `alias` SHALL be required in both `en` and `es`. The other attribute fields and the considerations SHALL be optional. `category_id` SHALL be required and SHALL name a category of the session's country that resolves and is enabled; otherwise the request SHALL be rejected with 400 and nothing SHALL be written. `baseline` and `compared_against` SHALL be both present when the category is temporal and both absent or `null` when it is not; otherwise the request SHALL be rejected with 400. The request SHALL be rejected with 422 when only one year is given, when `baseline` > `compared_against`, or when `pixel_size` ≤ 0. The index entry SHALL always contain `category_id`, `baseline` and `compared_against`, the years as `null` when the layer has none. The request SHALL NOT accept a list of countries.

#### Scenario: Successful creation

- **WHEN** a CO admin posts valid fields with `category_id: "deforestation"` and years, and CO's highest id is 2
- **THEN** a layer with id 3, `enabled: false`, `version: 0`, no raster and `category_id: "deforestation"` is created under `CO/`, and `GET /maps` does not list it

#### Scenario: Layer of a non-temporal category

- **WHEN** a CO admin posts `category_id: "protected_areas"` (not temporal) without years
- **THEN** the layer is created and its index entry has `baseline: null` and `compared_against: null`

#### Scenario: Years for a non-temporal category

- **WHEN** a CO admin posts `category_id: "protected_areas"` (not temporal) with `baseline: 2020` and `compared_against: 2023`
- **THEN** the response is 400 and nothing is written

#### Scenario: Missing years for a temporal category

- **WHEN** a CO admin posts `category_id: "deforestation"` without years
- **THEN** the response is 400 and nothing is written

#### Scenario: Category of another country

- **WHEN** only EC has a category `protected_areas_ec` and a CO admin posts `category_id: "protected_areas_ec"`
- **THEN** the response is 400 and nothing is written

#### Scenario: Disabled category

- **WHEN** CO's `frontier` is disabled and a CO admin posts `category_id: "frontier"`
- **THEN** the response is 400 and nothing is written

#### Scenario: Missing category

- **WHEN** an admin posts a layer without `category_id`
- **THEN** the response is 422

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

`PUT /admin/layers/{id}` SHALL replace a layer's editable index fields, its `category_id`, and its en/es attributes and considerations, using the same validation as creation, except that the layer MAY keep its current category while that category is disabled. Changing the `category_id` of a published (enabled) layer SHALL be rejected with 400. If the layer has a raster, changing `pixel_size` SHALL be rejected with 409 when its area differs from the raster's cell area by more than 5% at any latitude of the raster. It SHALL write to the layer's existing metadata filenames in its country's folder. It SHALL NOT change `id`, `raster_filename`, `version`, `enabled`, or the layer's country. Ids that are unknown or that belong to another country SHALL return 404.

#### Scenario: Edit a copied layer

- **WHEN** a CO admin updates the `es` considerations of layer 0 (CO's copy of GFW)
- **THEN** `CO/metadata/considerations/es/gfw.md` contains the new text, `GET /maps?country=CO&language=es` returns it, and EC's and CR's GFW are unchanged

#### Scenario: Move a hidden layer to another category

- **WHEN** CO's layer 3 is disabled, has `category_id: "frontier"` that doesn't resolve, and a CO admin puts it with `category_id: "protected_areas"` and no years
- **THEN** layer 3 belongs to `protected_areas`, with no years, and its `category_issue` is `null`

#### Scenario: Move a published layer

- **WHEN** CO's layer 0 is enabled in `deforestation` and a CO admin puts it with `category_id: "protected_areas"`
- **THEN** the response is 400 and nothing is written

#### Scenario: Keep a disabled category

- **WHEN** CO's layer 4 is disabled in the disabled category `frontier` and a CO admin edits its texts keeping `category_id: "frontier"`
- **THEN** the change is saved

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

`PATCH /admin/layers/{id}` with `{ "enabled": true | false }` SHALL change the layer's visibility in the public listing. Enabling a layer that has no raster file SHALL fail with 409. Enabling a layer whose category doesn't resolve in its country, or is disabled, or whose years don't fit its category (a temporal category needs both years, any other none) SHALL fail with 400. Disabling SHALL always be allowed. Ids that are unknown or that belong to another country SHALL return 404. There SHALL be no endpoint that hard-deletes a layer.

#### Scenario: Disable a layer

- **WHEN** an EC admin disables layer 2
- **THEN** `GET /maps?country=EC` no longer lists layer 2, and an analysis of EC's layer 2 still works

#### Scenario: Enable without raster

- **WHEN** an admin enables a newly created layer that has not ingested a raster
- **THEN** the response is 409 and the layer stays disabled

#### Scenario: Enable in a disabled category

- **WHEN** CO's layer 4 has a raster, its category `frontier` is disabled, and a CO admin enables it
- **THEN** the response is 400 and the layer stays disabled

#### Scenario: Enable with a broken category

- **WHEN** CO's layer 3 has a raster and `category_issue: "unknown_category"`, and a CO admin enables it
- **THEN** the response is 400 and the layer stays disabled

#### Scenario: Enable with years that don't fit the category

- **WHEN** CO's layer 7 has a raster and no years, its category `deforestation` is temporal, and a CO admin enables it
- **THEN** the response is 400 and the layer stays disabled

#### Scenario: Another country's layer

- **WHEN** a CR admin calls `PATCH /admin/layers/3` and only EC has a layer 3
- **THEN** the response is 404 and EC's layer 3 is unchanged
