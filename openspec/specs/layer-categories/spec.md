# layer-categories Specification

## Purpose
TBD - created by archiving change add-layer-categories. Update Purpose after archive.
## Requirements
### Requirement: Per-country category file

In the per-country layout, each country folder MAY contain `categories.json`: a JSON list of the country's layer categories. A missing file SHALL mean that the country has no stored categories. Each category SHALL have:

- `id`: a slug matching `^[a-z][a-z0-9_]{0,49}$`, unique within the country;
- `name`: an object with `es` and `en`, each 1 to 100 characters;
- `description`: an object with `es` and `en`, each up to 1000 characters;
- `icon`: one of `forest`, `park`, `wetland`, `leaf`, `wildlife`, `shield`, `legal`, `community`, `map`, `global`, `water`, `coast`, `flood`, `agriculture`, `crop`, `coffee`, `pasture`, `mountain`, `volcano`, `landslide`, `fire`, `mining`, `infrastructure`, `settlement`, `industry`, `layers`;
- `color`: a hex color matching `^#[0-9a-fA-F]{6}$`;
- `polarity`: `avoid` (a farm that coincides with the layer is a finding) or `required` (a farm that does not coincide is a finding);
- `threshold_percentage`: optional, `null` or a number from 0 to 100 inclusive;
- `result_labels`: an object with `ok` and `flagged`, each an object with `es` and `en` of 1 to 60 characters;
- `temporal`: a boolean, whether the category's layers have a baseline and a comparison year;
- `enabled`: a boolean, `true` when missing.

The file SHALL be read and written only through the storage module, under the same lock and with the same atomic write as `index.json`. Each category SHALL be validated on its own: a category that breaks any of these rules SHALL be rejected, and when an `id` appears more than once every entry with that id SHALL be rejected. A file that is not valid JSON or not a list SHALL be unreadable, and then none of its categories SHALL be used. Rejected categories SHALL NOT make the country's other categories or layers unavailable. An unreadable file SHALL hide the country's layers from the public listings without affecting other countries. An I/O error while reading the file SHALL make it unreadable only for that read: it SHALL NOT be cached, and the next read SHALL retry. For every problem the storage module SHALL log an error naming the file, the entry's position and id when it has one, and the reason, and SHALL make the list of problems readable to the admin. Category ids SHALL never be reused within a country.

#### Scenario: Category with an invalid polarity

- **WHEN** CO's `categories.json` contains `protected_areas` with `polarity: "inside"` and a valid `frontier`
- **THEN** `protected_areas` is rejected and an error names the file, the entry, and the reason, `GET /categories?country=CO` lists `deforestation` and `frontier`, and CO's other layers are still served

#### Scenario: Threshold out of range

- **WHEN** a category has `threshold_percentage: 120` or `-1`
- **THEN** that category is rejected

#### Scenario: Duplicated id

- **WHEN** two categories in one file have the id `protected_areas`
- **THEN** both are rejected

#### Scenario: Transient read error

- **WHEN** opening CO's `categories.json` fails once with an I/O error and then succeeds
- **THEN** only the failing read treats the file as unreadable, the next read returns CO's categories, and the error is logged as a read error, not as invalid content

#### Scenario: Unparseable file

- **WHEN** CO's `categories.json` is not valid JSON
- **THEN** no CO category resolves, including the built-in `deforestation`, `GET /categories?country=CO` returns an empty list, CO's layers are hidden from `GET /maps` and tagged `unreadable_categories`, and other countries are unaffected

#### Scenario: Missing file

- **WHEN** a country folder has no `categories.json`
- **THEN** the country's layers are served and its only category is the built-in `deforestation`

#### Scenario: An icon added to the catalogue

- **WHEN** CO's `categories.json` contains `volcanic_risk` with `icon: "volcano"`
- **THEN** `volcanic_risk` is valid and `GET /categories?country=CO` returns it with `icon: "volcano"`

### Requirement: Built-in deforestation category

Every country SHALL have a category with id `deforestation`. When the country has no `categories.json`, when its file is readable and has no entry with id `deforestation`, or in the legacy flat layout, the API SHALL synthesize it on read with: `name` "Deforestación" / "Deforestation", `icon` `forest`, `color` `#c62828`, `polarity` `avoid`, `threshold_percentage` `null`, `result_labels` ok "Libre de deforestación" / "Deforestation-free" and flagged "Con deforestación" / "With deforestation", `temporal` `true`, and `enabled` `true`. When the file defines `deforestation`, the stored definition SHALL be used instead, entirely. When the stored `deforestation` is rejected, or the file is unreadable, the built-in definition SHALL NOT be used, so a country's own threshold is never silently replaced by the global one. No file SHALL need to be written for existing layers to keep working.

#### Scenario: Invalid stored deforestation category

- **WHEN** CO's `categories.json` defines `deforestation` with `threshold_percentage: 150`
- **THEN** CO has no `deforestation` category, and its layers in that category are hidden from `GET /maps` and tagged `invalid_category`

#### Scenario: Share without categories

- **WHEN** the share has CO's `index.json` with GFW, TMF, and IDEAM, none with a `category_id`, and no `categories.json`
- **THEN** `GET /categories?country=CO` returns only `deforestation` with `polarity: "avoid"`, and `GET /maps?country=CO` returns `categoryId: "deforestation"` for all three layers

#### Scenario: Stored deforestation category

- **WHEN** CO's `categories.json` defines `deforestation` with `threshold_percentage: 5`
- **THEN** `GET /categories?country=CO` returns one `deforestation` category with `thresholdPercentage: 5`

### Requirement: Every layer belongs to a category of its country

Each index entry SHALL have an optional `category_id`. An entry without it SHALL belong to `deforestation`. When the storage module reads a country's layers, it SHALL resolve each layer's category among that country's categories, enabled or not, and SHALL tag each layer with a `category_issue`: none when the category resolves, `unknown_category` when the country has no category with that id, `invalid_category` when the category with that id was rejected, or `unreadable_categories` when the country's category file can't be parsed. For each issue it SHALL log an error naming the country, the layer, and the category. A layer with an issue SHALL NOT be listed by `GET /maps` or counted by `GET /countries`, SHALL NOT make any other layer of its country unavailable, and SHALL still resolve by id for analysis, tiles, and images. The issue SHALL be readable from the storage module so the admin can show it; the tag SHALL never be written to `index.json`. In the legacy flat layout the only category that resolves SHALL be `deforestation`.

#### Scenario: Layer pointing at an unknown category

- **WHEN** CO's layer 3 has `category_id: "frontier"` and CO has no category `frontier`
- **THEN** layer 3 is not in `GET /maps?country=CO`, CO's other layers are, the storage module tags layer 3 with `unknown_category`, and an error names CO, layer 3, and `frontier`

#### Scenario: Unresolved layer still analyzable by id

- **WHEN** a browser that loaded CO's layer 3 before its category broke posts an analysis with `maps: [3]`
- **THEN** the API returns layer 3's `value` as before

#### Scenario: Layer of a disabled category

- **WHEN** CO's layer 3 has `category_id: "frontier"` and CO's `frontier` category is disabled
- **THEN** CO's layers are readable, and layer 3 still resolves by id for analysis and tiles

#### Scenario: Flat layout

- **WHEN** the API serves the Git-tracked `app/maps` flat layout
- **THEN** every layer has `categoryId: "deforestation"`

### Requirement: Public list of a country's categories

`GET /categories` SHALL require a `country` query parameter (ISO 3166-1 alpha-2, 422 when missing or malformed) and SHALL return the country's enabled categories, in file order with a synthesized `deforestation` first. It SHALL NOT require authentication. Each category SHALL be returned in camelCase with `id`, `name`, `description`, `icon`, `color`, `polarity`, `thresholdPercentage`, `resultLabels`, and `temporal`, all always present. Texts SHALL carry both `es` and `en`. `thresholdPercentage` SHALL be the category's `threshold_percentage` or, when it has none, the global `DEFORESTATION_THRESHOLD_PERCENTAGE`; it SHALL never be `null`. A country that is not registered or is disabled SHALL return an empty list. In the legacy flat layout, a country listed by at least one enabled layer SHALL return the built-in category, and any other country an empty list. Rejected categories and an unreadable category file SHALL NOT make the endpoint fail: it lists only the categories that resolve. When the country's `index.json` cannot be read, the endpoint SHALL answer 500, like `GET /maps`.

#### Scenario: Categories of a country

- **WHEN** CO's `categories.json` holds `protected_areas` (enabled, `threshold_percentage: 0`) and `frontier` (disabled), and a client calls `GET /categories?country=CO`
- **THEN** the response lists `deforestation` and `protected_areas`, with `thresholdPercentage` equal to the global threshold for `deforestation` and `0` for `protected_areas`, and does not list `frontier`

#### Scenario: Another country's categories

- **WHEN** EC has a category `protected_areas_ec` and a client calls `GET /categories?country=CO`
- **THEN** `protected_areas_ec` is not in the response

#### Scenario: Disabled or unknown country

- **WHEN** a client calls `GET /categories?country=PE` and PE is not registered, or is disabled
- **THEN** the response is 200 with an empty list

#### Scenario: Country missing

- **WHEN** a client calls `GET /categories` without `country`
- **THEN** the response is 422

### Requirement: Rollback safety of category data

Index entries written by the API SHALL always contain the `baseline` and `compared_against` keys, `null` when the layer has no years, so that a release before categories can still read them. The layers documentation SHALL describe what a release without categories does with `category_id`, `categories.json`, and layers of non-`deforestation` categories, and SHALL state that every layer whose category is not `deforestation` must be disabled before rolling the API back to such a release.

#### Scenario: Rolling back with only deforestation layers

- **WHEN** the share has `category_id: "deforestation"` in its index entries and a `categories.json`, and the API is rolled back to the release before categories
- **THEN** `GET /maps`, analysis, tiles, and the admin keep working, and admin edits keep each entry's `category_id`

