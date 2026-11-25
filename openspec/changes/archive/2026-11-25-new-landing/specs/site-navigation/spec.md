## ADDED Requirements

### Requirement: Header brand

The header SHALL show, on every page, the Monbo logo followed by a thin separator and the PNUD mark ("PNUD" in Spanish, "UNDP" in English). Activating the logo SHALL open the start page. On the start page the logo SHALL be the white version; on every other page, the regular one.

#### Scenario: Spanish brand

- **WHEN** a user opens `/polygons-validation` in Spanish
- **THEN** the header shows the Monbo logo and the "PNUD" mark

#### Scenario: English brand

- **WHEN** a user opens `/en`
- **THEN** the header shows the white Monbo logo and the "UNDP" mark

### Requirement: Header navigation links

The header SHALL show the links "Inicio", "Análisis" and "Metodología" ("Home", "Analysis", "Methodology" in English) after the brand, on the light and the dark header. On the admin pages, "Inicio" and "Análisis" SHALL be replaced by the admin sections, as today, and "Metodología" SHALL still be shown. The link of the current section SHALL be marked as active (`aria-current="page"`).

- "Inicio" SHALL open the start page. It SHALL be active on the start page.
- "Análisis" SHALL resume the flow: it SHALL open the deforestation analysis page when an analysis result exists, the polygon validation page when validation results exist, and the stage 1 upload page otherwise. It SHALL be active on every page under `/polygons-validation`, `/deforestation-analysis` and `/report-generation`.
- "Metodología" SHALL open the documentation page (`/documentation`) in the current language. It SHALL be active there.

The header SHALL NOT show the former module buttons ("Validación polígonos", "Análisis deforestación", "Generación reporte"); their removal belongs to GC-10.

#### Scenario: Start the analysis from the header

- **WHEN** no farms are loaded and the user clicks "Análisis" on the start page
- **THEN** the browser opens `/polygons-validation/upload-data`

#### Scenario: Resume after an analysis

- **WHEN** an analysis result exists and the user, on the documentation page, clicks "Análisis"
- **THEN** the browser opens `/deforestation-analysis`

#### Scenario: Active link

- **WHEN** the user is on `/deforestation-analysis/upload-data`
- **THEN** "Análisis" is marked as the current page and "Inicio" and "Metodología" are not

#### Scenario: Admin pages

- **WHEN** a logged-in admin is on `/admin/layers`
- **THEN** the header shows the admin sections and "Metodología", and not "Inicio" or "Análisis"

### Requirement: Navigation on narrow screens

Below 900 px wide the header SHALL move the "Inicio", "Análisis" and "Metodología" links into a menu button, and keep the brand, the country selector (outside the start page) and the language menu on one line, so that the header never overflows horizontally and every link stays reachable.

#### Scenario: Phone

- **WHEN** the start page is opened at a 390×844 viewport
- **THEN** the header shows the brand, the menu button and the language menu on one line, without horizontal scroll, and the menu lists the three links
