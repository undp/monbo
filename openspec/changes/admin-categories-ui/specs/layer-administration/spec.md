## ADDED Requirements

### Requirement: Category administration UI

The admin SHALL provide a categories page at `/[locale]/admin/categories` that lists every category of the session's country (from `GET /admin/categories`), enabled or not, in the order the API returns. Each category SHALL show its icon on its color, its name in Spanish and English, its description, what its layers mark (its polarity in words), its threshold (its own, or the global one from `GET /config` when `thresholdPercentage` is `null`), its "no findings" and "with findings" result texts as chips, its layers with how many are published, whether it is enabled, a control to enable or disable it and a way to edit it. When the country's categories file can't be read (`readable: false`), the page SHALL show the file's errors and SHALL NOT offer to create, edit, enable or disable categories; when it is readable but has rejected entries, the page SHALL show those errors and keep working.

Creating and editing SHALL happen in a panel with the name and description in Spanish and English, the icon (from the catalogue of `GET /categories`), the color, whether its layers compare two years (`temporal`), the threshold (the global one or its own, 0 to 100), the "no findings" and "with findings" texts in Spanish and English, and the polarity. The polarity SHALL be chosen explicitly: a new category SHALL start with no polarity, each option SHALL explain what counts as a finding (`avoid`: a polygon that overlaps the layer; `required`: a polygon that falls outside it), and the panel SHALL NOT save without one. When creating, the panel SHALL suggest the category id from the Spanish name, let the admin edit it, say that it is permanent, and refuse an id that doesn't match `^[a-z][a-z0-9_]{0,49}$` or is already used in the country; when editing, the id SHALL NOT be editable.

The panel SHALL show a preview of the category chip and of a "no findings" and a "with findings" result chip, each with its example polygon. The examples SHALL be classified with the same classification the analysis uses, so the preview SHALL change with the polarity and the threshold: with `avoid` the polygon with findings is one that overlaps the layer, with `required` one that falls outside it. "No findings" chips SHALL use the theme's success color and "with findings" chips red, whatever the category color.

The page and the panel SHALL explain the API's rules before the admin acts, naming the layers involved and how to proceed:

- a category with published layers SHALL NOT offer to be enabled or disabled, and SHALL say to hide those layers first;
- the polarity of a category with published layers SHALL NOT be editable, with the same explanation;
- `temporal` SHALL NOT be editable while the category has any layer.

Any refusal the UI didn't prevent SHALL be shown with a translated message and the API's reason.

#### Scenario: Create the agricultural frontier

- **WHEN** a CO admin opens the categories page, chooses "New category", types "Frontera agrícola" / "Agricultural frontier", chooses the polarity `required`, fills the result texts and saves
- **THEN** the API receives `POST /admin/categories` with `id: "frontera_agricola"`, `polarity: "required"` and `thresholdPercentage: null`, and the page shows the new category, enabled and without layers

#### Scenario: No polarity chosen

- **WHEN** an admin fills every field of a new category except the polarity and saves
- **THEN** nothing is sent to the API and the panel asks to choose what its layers mark

#### Scenario: Preview follows the polarity

- **WHEN** an admin chooses `avoid` and then `required` in the panel
- **THEN** the preview's polygon with findings changes from one that overlaps the layer to one that falls outside it, and the "with findings" chip keeps showing the finding and the "with findings" text

#### Scenario: Taken id

- **WHEN** CO has a category `protected_areas` and an admin types the id `protected_areas` for a new category
- **THEN** the id field says it is already used and the panel doesn't save

#### Scenario: Category with published layers

- **WHEN** CO's `deforestation` has the published layer "IDEAM 2020-2023" and an admin looks at its card and opens its panel
- **THEN** its enable control is locked, the polarity can't be changed, and both say to hide "IDEAM 2020-2023" first, while the threshold, texts, icon and color can still be edited

#### Scenario: Temporal locked by any layer

- **WHEN** CO's `protected_areas` has a hidden layer and an admin edits it
- **THEN** whether its layers compare two years can't be changed, and the panel says why

#### Scenario: Disable an empty category

- **WHEN** CO's `frontier` has no published layers and an admin disables it from its card
- **THEN** the API receives `PATCH /admin/categories/frontier` with `enabled: false` and the card shows the category as disabled

#### Scenario: Unreadable categories file

- **WHEN** CO's `categories.json` is not valid JSON and an admin opens the categories page
- **THEN** the page shows the file's error, and there is no way to create, edit, enable or disable categories

## MODIFIED Requirements

### Requirement: Admin UI

The frontend SHALL provide admin pages under `/[locale]/admin`:

- a login page that asks only for the passkey;
- a layers list showing name, alias, id, category, version, enabled state, and raster presence, with an enable/disable control;
- a create/edit form for the index fields and the layer's category, with en/es tabs for attributes and considerations and a rendered markdown preview of the considerations, and with no countries field; each tab labels its fields in the tab's language, and an info button next to the texts section opens an example of a filled-in layer;
- a raster section on the edit page that guides the upload in steps (see "Raster upload in steps");
- a categories page (see "Category administration UI");
- a usage page (see the `usage-dashboard` capability).

The layer form SHALL require choosing the layer's category: a new layer SHALL start without one, and the choices SHALL be the country's enabled categories plus the layer's current category when it is disabled or doesn't resolve, shown as such. A category that doesn't resolve SHALL NOT be accepted on save. The category of a published layer SHALL NOT be editable, and the form SHALL say to hide the layer first. The baseline and comparison years SHALL be shown, required and sent only when the chosen category is temporal; otherwise the form SHALL send them as `null`.

The layers list and the layer editor SHALL say why a layer that is enabled is not public, and how to fix it: its category doesn't exist, is invalid in the categories file, or the file can't be read (`category_issue`); its category is disabled; its years don't fit the category (`layer_issue: years_mismatch`); or it has no raster (`layer_issue: missing_raster`). When an admin tries to publish a layer that one of these reasons blocks, the UI SHALL show that reason instead of a generic error.

Every admin page SHALL show the name of the country the session administers in the header. The layer and category pages SHALL also show it in their title, under a "Layers admin" overline; the usage page covers every country, so its title has neither. On the admin pages the header SHALL show only the language selector and, once logged in, the administered country's name as plain text and a navigation with three items, "Layers", "Categories" and "Usage", that marks the current one. Below 900 px wide, the administered country and the three items SHALL move into the header's menu, so the admin pages fit a 390 px screen without horizontal scrolling. It SHALL NOT show the public navigation or the country selector. All UI text SHALL be translated in `en` and `es`. The admin pages SHALL NOT be linked from the public home page or header.

#### Scenario: Create and publish a layer from the UI

- **WHEN** a CO admin logs in, creates a layer in a category, uploads a valid binary raster, waits for it to be validated, and publishes the layer from the raster section
- **THEN** the layer appears in the public map selection for Colombia only, in its category, with its metadata and tiles

#### Scenario: Layer of a non-temporal category

- **WHEN** an admin edits a layer of `protected_areas`, which is not temporal, and saves
- **THEN** the form shows no years and the API receives `baseline: null` and `compared_against: null`

#### Scenario: Layer of a temporal category

- **WHEN** an admin creates a layer in `deforestation` and leaves the comparison year empty
- **THEN** the form asks for the year and doesn't save

#### Scenario: No category chosen

- **WHEN** an admin fills a new layer without choosing a category and saves
- **THEN** nothing is sent to the API and the category field asks for one

#### Scenario: Published layer keeps its category

- **WHEN** an admin opens the editor of a published layer
- **THEN** its category can't be changed, and the form says to hide the layer first

#### Scenario: Enabled layer hidden by a disabled category

- **WHEN** CO's layer 4 is enabled, has a raster, and its category `frontier` is disabled
- **THEN** the layers list shows `frontier` in its category column and says that the layer is not public because its category is disabled, and the layer's editor says the same

#### Scenario: Broken category shown

- **WHEN** CO's layer 3 has `category_issue: "unknown_category"` with `category_id: "frontier"`
- **THEN** the layers list shows `frontier` as a category that doesn't exist, and the editor asks to choose a valid category before saving

#### Scenario: Country shown

- **WHEN** an admin logs in with EC's passkey
- **THEN** the admin pages and the header show "Ecuador" as the administered country

#### Scenario: Language switch

- **WHEN** an admin switches the UI language to `es`
- **THEN** every admin label, message, and validation error is shown in Spanish, except the fields of the English tab, which stay in English

#### Scenario: Not discoverable from public pages

- **WHEN** a visitor browses the home page and header
- **THEN** there is no link to the admin pages

#### Scenario: Navigate between layers, categories and usage

- **WHEN** a logged-in admin on the layers list clicks "Categories" in the admin header
- **THEN** the categories page opens and "Categories" is marked as the current item

#### Scenario: Navigation on a phone

- **WHEN** a logged-in CO admin opens the categories page on a 390 px wide screen and opens the header's menu
- **THEN** the menu shows "Colombia", then "Layers", "Categories" (marked as current) and "Usage", and the page doesn't scroll horizontally

#### Scenario: No navigation before login

- **WHEN** a visitor opens the admin login page
- **THEN** the admin header shows no "Layers", "Categories" or "Usage" items
