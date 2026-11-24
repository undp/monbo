## MODIFIED Requirements

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
