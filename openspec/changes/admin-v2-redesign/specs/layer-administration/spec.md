## MODIFIED Requirements

### Requirement: Category administration UI

The admin SHALL provide a categories page at `/[locale]/admin/categories` that lists every category of the session's country (from `GET /admin/categories`), enabled or not, in the order the API returns, one under the other. Each category SHALL show its icon on its color, its name in Spanish and English, its description, what its layers mark (its polarity in words), its threshold (its own, or the global one from `GET /config` when `thresholdPercentage` is `null`), its "no findings" and "with findings" result texts as chips, its layers with how many are published, whether it is enabled, a control to enable or disable it and a way to edit it. On a wide screen the result texts SHALL sit beside the category's description, not under it. The page SHALL NOT list the country's layers. When the country's categories file can't be read (`readable: false`), the page SHALL show the file's errors and SHALL NOT offer to create, edit, enable or disable categories; when it is readable but has rejected entries, the page SHALL show those errors and keep working.

Creating and editing SHALL happen on a page of their own: `/[locale]/admin/categories/new` to create, and `/[locale]/admin/categories/{id}` to edit, with a way back to the categories page. An `{id}` that doesn't match `^[a-z][a-z0-9_]{0,49}$` SHALL get the not-found page; an `{id}` that is not a category of the country SHALL say so, with the way back. The editor SHALL have the name and description in Spanish and English, the icon (from the catalogue of `GET /categories`), the color, whether its layers compare two years (`temporal`), the threshold (the global one or its own, 0 to 100), the "no findings" and "with findings" texts in Spanish and English, and the polarity. The polarity SHALL be chosen explicitly: a new category SHALL start with no polarity, each option SHALL explain what counts as a finding (`avoid`: a polygon that overlaps the layer; `required`: a polygon that falls outside it), and the editor SHALL NOT save without one. When creating, the editor SHALL NOT ask for the id: it SHALL say that the API makes it from the Spanish name and that it is permanent. When editing, the editor SHALL show the id, not editable. Once saved, the editor SHALL go back to the categories page, which shows the saved category.

The editor SHALL show a preview of the category chip and of a "no findings" and a "with findings" result chip, each with its example polygon. On a wide screen the preview SHALL sit beside the form and stay in view while the form scrolls. The examples SHALL be classified with the same classification the analysis uses, so the preview SHALL change with the polarity and the threshold: with `avoid` the polygon with findings is one that overlaps the layer, with `required` one that falls outside it. "No findings" chips SHALL use the theme's success color and "with findings" chips red, whatever the category color.

The page and the editor SHALL explain the API's rules before the admin acts, naming the layers involved and how to proceed:

- a category with published layers SHALL NOT offer to be enabled or disabled, and SHALL say to hide those layers first;
- the polarity of a category with published layers SHALL NOT be editable, with the same explanation;
- `temporal` SHALL NOT be editable while the category has any layer.

Any refusal the UI didn't prevent SHALL be shown with a translated message and the API's reason.

#### Scenario: Create the agricultural frontier

- **WHEN** a CO admin opens the categories page, chooses "New category", types "Frontera agrícola" / "Agricultural frontier" on the page that opens, chooses the polarity `required`, fills the result texts and saves
- **THEN** the API receives `POST /admin/categories` without an `id`, with `polarity: "required"` and `thresholdPercentage: null`, and the categories page shows the new category `frontera_agricola`, enabled and without layers

#### Scenario: Edit on its own page

- **WHEN** a CO admin chooses "Edit" on the card of `protected_areas`
- **THEN** `/admin/categories/protected_areas` opens with the category's values, its id not editable, and the preview beside the form

#### Scenario: Unknown category

- **WHEN** a CO admin opens `/admin/categories/wetlands` and CO has no category `wetlands`
- **THEN** the page says the category doesn't exist and offers the way back to the categories page

#### Scenario: Malformed id

- **WHEN** an admin opens `/admin/categories/Protected-Areas`
- **THEN** the not-found page opens

#### Scenario: Cards in a list, without layers

- **WHEN** a CO admin opens the categories page on a wide screen
- **THEN** the cards are one under the other, each with its result texts beside its description, and the page has no table of layers

#### Scenario: No polarity chosen

- **WHEN** an admin fills every field of a new category except the polarity and saves
- **THEN** nothing is sent to the API and the editor asks to choose what its layers mark

#### Scenario: Preview follows the polarity

- **WHEN** an admin chooses `avoid` and then `required` in the editor
- **THEN** the preview's polygon with findings changes from one that overlaps the layer to one that falls outside it, and the "with findings" chip keeps showing the finding and the "with findings" text

#### Scenario: Taken id

- **WHEN** CO has a category `protected_areas` and an admin types the id `protected_areas` for a new category
- **THEN** the id field says it is already used and the editor doesn't save

#### Scenario: Category with published layers

- **WHEN** CO's `deforestation` has the published layer "IDEAM 2020-2023" and an admin looks at its card and opens its editor
- **THEN** its enable control is locked, the polarity can't be changed, and both say to hide "IDEAM 2020-2023" first, while the threshold, texts, icon and color can still be edited

#### Scenario: Temporal locked by any layer

- **WHEN** CO's `protected_areas` has a hidden layer and an admin edits it
- **THEN** whether its layers compare two years can't be changed, and the editor says why

#### Scenario: Disable an empty category

- **WHEN** CO's `frontier` has no published layers and an admin disables it from its card
- **THEN** the API receives `PATCH /admin/categories/frontier` with `enabled: false` and the card shows the category as disabled

#### Scenario: Unreadable categories file

- **WHEN** CO's `categories.json` is not valid JSON and an admin opens the categories page
- **THEN** the page shows the file's error, and there is no way to create, edit, enable or disable categories

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

The layers list and the layer editor SHALL say why a layer that is enabled is not public, and how to fix it: its category doesn't exist, is invalid in the categories file, or the file can't be read (`category_issue`); its category is disabled; its years don't fit the category (`layer_issue: years_mismatch`); or it has no raster (`layer_issue: missing_raster`). When an admin tries to publish a layer that one of these reasons blocks, the UI SHALL show that reason instead of a generic error.

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

### Requirement: Create a category

`POST /admin/categories` SHALL create a category in the country of the admin's session from the fields `name`, `description`, `icon`, `color`, `polarity`, `thresholdPercentage` (optional, `null` for the global threshold), `resultLabels` and `temporal`, validated with the rules of the per-country category file. The request SHALL NOT accept an `id`: the API SHALL make it from the Spanish name, in lowercase ASCII letters, digits and underscores, starting with a letter and at most 50 characters ("Frontera agrícola" → `frontera_agricola`), and SHALL use `category` when the name has no letter to start one with. When that id is already used in the country, by a valid or a rejected entry, or is `deforestation` or `new` (the path of the admin's create page), the API SHALL add `_2`, `_3` and so on, so category ids are never reused. The response SHALL return the id. The new category SHALL start enabled and SHALL be added at the end of the country's `categories.json`. Invalid fields SHALL be rejected with 422. When layers of the country already point at the id (for example after a hand edit), the request SHALL be rejected with 400, naming those layers, while any of them is published or has years that don't fit the new `temporal` (a temporal category needs both years, any other none); those layers SHALL become public only by being enabled afterwards. When the country's `categories.json` can't be read, the request SHALL be rejected with 409 and the file SHALL NOT be changed. The request SHALL NOT accept a country.

#### Scenario: Create protected areas

- **WHEN** a CO admin posts the Spanish name "Protected areas", `polarity: "avoid"`, `temporal: false`, `thresholdPercentage: 0` and valid texts
- **THEN** the response is 201 with `id: "protected_areas"`, `GET /admin/categories` lists it enabled with no layers, and `GET /categories?country=CO` lists it with `thresholdPercentage: 0`

#### Scenario: Used id

- **WHEN** CO already has a disabled category `frontier` and a CO admin posts the Spanish name "Frontier"
- **THEN** the response is 201 with `id: "frontier_2"`, and `frontier` is unchanged

#### Scenario: Reserved id

- **WHEN** a CO admin posts the Spanish name "New"
- **THEN** the category is created with `id: "new_2"`, so its edit page isn't hidden by the create page

#### Scenario: An id sent by the client

- **WHEN** an admin posts `id: "frontier"`
- **THEN** the response is 422 and nothing is written

#### Scenario: Invalid polarity

- **WHEN** an admin posts `polarity: "inside"`
- **THEN** the response is 422 and nothing is written

#### Scenario: Create a category that published layers already point at

- **WHEN** CO's layer 8 is enabled with `category_id: "wetlands"`, CO has no `wetlands` category, and a CO admin posts the Spanish name "Wetlands"
- **THEN** the response is 400 naming layer 8, nothing is written, and `GET /maps?country=CO` still doesn't list layer 8

#### Scenario: Create a category over hidden layers

- **WHEN** CO's hidden layer 8 has `category_id: "wetlands"` and both years, and a CO admin posts the Spanish name "Wetlands" with `temporal: true`
- **THEN** the category `wetlands` is created, layer 8 stays hidden, and enabling it publishes it

#### Scenario: Same id in another country

- **WHEN** EC has `protected_areas` and a CO admin posts the Spanish name "Protected areas"
- **THEN** the category `protected_areas` is created in CO and EC's is unchanged
