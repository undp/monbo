## MODIFIED Requirements

### Requirement: Admin UI

The frontend SHALL provide admin pages under `/[locale]/admin`:

- a login page that asks only for the passkey;
- a layers list showing name, alias, id, version, enabled state, and raster presence, with an enable/disable control;
- a create/edit form for the index fields, with en/es tabs for attributes and considerations and a rendered markdown preview of the considerations, and with no countries field; each tab labels its fields in the tab's language, and an info button next to the texts section opens an example of a filled-in layer;
- a raster section on the edit page that guides the upload in steps (see "Raster upload in steps");
- a usage page (see the `usage-dashboard` capability).

Every admin page SHALL show the name of the country the session administers in the header. The layer pages SHALL also show it in their title, under a "Layers admin" overline; the usage page covers every country, so its title has neither. On the admin pages the header SHALL show only the language selector and, once logged in, the administered country's name as plain text and a navigation with two items, "Layers" and "Usage", that marks the current one. It SHALL NOT show the public navigation or the country selector. All UI text SHALL be translated in `en` and `es`. The admin pages SHALL NOT be linked from the public home page or header.

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

#### Scenario: Navigate between layers and usage

- **WHEN** a logged-in admin on the layers list clicks "Usage" in the admin header
- **THEN** the usage page opens and "Usage" is marked as the current item

#### Scenario: No navigation before login

- **WHEN** a visitor opens the admin login page
- **THEN** the admin header shows no "Layers" or "Usage" items
