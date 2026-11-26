## MODIFIED Requirements

### Requirement: List all layers for administration

`GET /admin/layers` SHALL return every layer, enabled or disabled, of the country in the admin's session, and no layer of any other country. A layer whose `id` is not an integer SHALL be left out and logged, because no admin route can address it; one bad layer SHALL NOT make the listing fail. Each entry SHALL include:

- the index fields: `id`, `pixel_size`, `baseline`, `compared_against`, `references`, `enabled`, `version`, `raster_filename`, `category_id` (`deforestation` when the entry has none); a field whose stored value is invalid SHALL be shown empty (`null`, or `[]` for `references`), and so SHALL the attributes or considerations of an invalid file name;
- `category_issue`: `null` when the layer's category resolves in its country, otherwise `unknown_category`, `invalid_category` or `unreadable_categories`;
- `category_enabled`: whether the layer's category resolves and is enabled;
- `layer_issue`: `null`, or why the layer can't be public even with a usable category: `invalid_fields` when an index field has an invalid type (see `layer-storage`, "Public listing returns enabled layers with version"), else `years_mismatch` when its years don't fit the category's `temporal`, `missing_raster` when it has no raster;
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

#### Scenario: Field of an invalid type

- **WHEN** a hand edit leaves CO's layer 7 with `version: "abc"`, `pixel_size: "abc"`, `references: "x"` or `references: [1, 2]`
- **THEN** `GET /admin/layers` answers 200 and shows layer 7 with `layer_issue: "invalid_fields"`, and that field as `null` (`version`, `pixel_size`) or `[]` (`references`)

#### Scenario: Id that isn't an integer

- **WHEN** a hand edit leaves a CO layer with `id: "abc"`
- **THEN** `GET /admin/layers` answers 200 with CO's other layers, and an error is logged

#### Scenario: Legacy layer

- **WHEN** CO's layer 0 has no `category_id` in the index
- **THEN** it appears with `category_id: "deforestation"`, `category_issue: null` and `category_enabled: true`

### Requirement: Enable and disable layers

`PATCH /admin/layers/{id}` with `{ "enabled": true | false }` SHALL change the layer's visibility in the public listing. Enabling a layer that has no raster file SHALL fail with 409. Enabling a layer whose category doesn't resolve in its country, or is disabled, or whose years don't fit its category (a temporal category needs both years, any other none), or whose index fields have an invalid type (`layer_issue: invalid_fields`), SHALL fail with 400. Disabling SHALL always be allowed. Ids that are unknown or that belong to another country SHALL return 404. There SHALL be no endpoint that hard-deletes a layer.

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

#### Scenario: Enable with an index field of an invalid type

- **WHEN** CO's layer 7 has a raster and `version: "abc"`, and a CO admin enables it
- **THEN** the response is 400 and the layer stays disabled

#### Scenario: Another country's layer

- **WHEN** a CR admin calls `PATCH /admin/layers/3` and only EC has a layer 3
- **THEN** the response is 404 and EC's layer 3 is unchanged

### Requirement: Admin UI

The frontend SHALL provide admin pages under `/[locale]/admin`:

- a login page that asks only for the passkey;
- a layers list showing id, name with its alias under it, category, period, raster presence, version and enabled state, with an enable/disable control;
- a create/edit form for the index fields and the layer's category, with en/es tabs for attributes and considerations and a rendered markdown preview of the considerations, and with no countries field; each tab labels its fields in the tab's language, and an info button next to the texts section opens an example of a filled-in layer;
- a raster section on the edit page that guides the upload in steps (see "Raster upload in steps");
- a categories page (see "Category administration UI");
- a usage page (see the `usage-dashboard` capability).

A layer's period in the layers list SHALL be its baseline and comparison years ("2020 → 2023") when it has both, "Current" when it has none and its category is not temporal, and "—" otherwise (a temporal layer without its years, or a layer without years whose category doesn't resolve).

The layer form SHALL require choosing the layer's category: a new layer SHALL start without one, and the choices SHALL be the country's enabled categories plus the layer's current category when it is disabled or doesn't resolve, shown as such. A category that doesn't resolve SHALL NOT be accepted on save. The category of a published layer SHALL NOT be editable, and the form SHALL say to hide the layer first. The baseline and comparison years SHALL be shown, required and sent only when the chosen category is temporal; otherwise the form SHALL send them as `null`.

The layers list and the layer editor SHALL say why a layer that is enabled is not public, and how to fix it: its category doesn't exist, is invalid in the categories file, or the file can't be read (`category_issue`); its category is disabled; an index field has an invalid type, which the operations team fixes in the index (`layer_issue: invalid_fields`); its years don't fit the category (`layer_issue: years_mismatch`); or it has no raster (`layer_issue: missing_raster`). The layers list SHALL show "—" as the version of a layer whose version can't be read, and the layer form SHALL start with an empty, required pixel size when the stored one can't be read. When an admin tries to publish a layer that one of these reasons blocks, the UI SHALL show that reason instead of a generic error.

Every signed-in admin page SHALL show a sidebar at its left with the name of the country the session administers, under "Admin session"; a navigation with three items, "Layers", "Categories" and "Usage", that marks the current one; and "Log out", at the sidebar's bottom. Logging out SHALL end the session and open the admin login. The layer and category pages SHALL show the administered country in their eyebrow, "Admin · {country}", above their title; the usage page covers every country, so its eyebrow SHALL be "Admin" alone. On the admin pages the header SHALL show only the language selector and the "Methodology" link of the site navigation (`site-navigation`). It SHALL NOT show the other public links ("Home", "Analysis"), the country selector, the admin sections or the administered country. Below 900 px wide, the sidebar SHALL be hidden and the header's menu SHALL show the administered country and the three items before "Methodology", and "Log out" after it, so the admin pages fit a 390 px screen without horizontal scrolling. All UI text SHALL be translated in `en` and `es`. The admin pages SHALL NOT be linked from the public home page or header.

#### Scenario: Create and publish a layer from the UI

- **WHEN** a CO admin logs in, creates a layer in a category, uploads a valid binary raster, waits for it to be validated, and publishes the layer from the raster section
- **THEN** the layer appears in the public map selection for Colombia only, in its category, with its metadata and tiles

#### Scenario: Layer of a non-temporal category

- **WHEN** an admin edits a layer of `protected_areas`, which is not temporal, and saves
- **THEN** the form shows no years and the API receives `baseline: null` and `compared_against: null`

#### Scenario: Layer of a temporal category

- **WHEN** an admin creates a layer in `deforestation` and leaves the comparison year empty
- **THEN** the form asks for the year and doesn't save

#### Scenario: Layers' periods

- **WHEN** CO has layer 1 in `deforestation` with baseline 2020 and comparison year 2023, and layer 4 in `protected_areas`, which is not temporal
- **THEN** the layers list shows "2020 → 2023" as the period of layer 1 and "Current" as that of layer 4

#### Scenario: No category chosen

- **WHEN** an admin fills a new layer without choosing a category and saves
- **THEN** nothing is sent to the API and the category field asks for one

#### Scenario: Published layer keeps its category

- **WHEN** an admin opens the editor of a published layer
- **THEN** its category can't be changed, and the form says to hide the layer first

#### Scenario: Enabled layer hidden by a disabled category

- **WHEN** CO's layer 4 is enabled, has a raster, and its category `frontier` is disabled
- **THEN** the layers list shows `frontier` in its category column and says that the layer is not public because its category is disabled, and the layer's editor says the same

#### Scenario: Layer with an index field of an invalid type

- **WHEN** CO's layer 7 is enabled and has `layer_issue: "invalid_fields"` and `version: null`
- **THEN** the layers list shows "—" as its version and says that the layer is not public because its index entry has invalid fields and that the operations team must fix it, and the layer's editor says the same

#### Scenario: Broken category shown

- **WHEN** CO's layer 3 has `category_issue: "unknown_category"` with `category_id: "frontier"`
- **THEN** the layers list shows `frontier` as a category that doesn't exist, and the editor asks to choose a valid category before saving

#### Scenario: Country shown

- **WHEN** an admin logs in with EC's passkey
- **THEN** the sidebar shows "Ecuador" as the administered country, and the layers page's eyebrow reads "Admin · Ecuador"

#### Scenario: Language switch

- **WHEN** an admin switches the UI language to `es`
- **THEN** every admin label, message, and validation error is shown in Spanish, except the fields of the English tab, which stay in English

#### Scenario: Not discoverable from public pages

- **WHEN** a visitor browses the home page and header
- **THEN** there is no link to the admin pages

#### Scenario: Navigate between layers, categories and usage

- **WHEN** a logged-in admin on the layers list clicks "Categories" in the sidebar
- **THEN** the categories page opens and "Categories" is marked as the current item

#### Scenario: Minimal header

- **WHEN** a logged-in CO admin opens the layers page on a wide screen
- **THEN** the header shows only "Methodology" and the language selector, without the admin sections, "Colombia" or the country selector

#### Scenario: Log out from the sidebar

- **WHEN** a logged-in admin clicks "Log out" at the bottom of the sidebar
- **THEN** the session token is removed and the admin login opens

#### Scenario: Navigation on a phone

- **WHEN** a logged-in CO admin opens the categories page on a 390 px wide screen and opens the header's menu
- **THEN** there is no sidebar, the menu shows "Colombia", then "Layers", "Categories" (marked as current), "Usage", "Methodology" and "Log out", and the page doesn't scroll horizontally

#### Scenario: Layer editor on a phone

- **WHEN** a CO admin opens a layer's editor, raster steps included, on a 390 px wide screen
- **THEN** the page doesn't scroll horizontally

#### Scenario: No navigation before login

- **WHEN** a visitor opens the admin login page
- **THEN** the page has no sidebar, and the header shows no "Layers", "Categories", "Usage" or "Log out" items
