## MODIFIED Requirements

### Requirement: Header navigation links

The header SHALL show the links "Inicio", "Análisis" and "Metodología" ("Home", "Analysis", "Methodology" in English) after the brand, on the light and the dark header. On the admin pages, "Inicio" and "Análisis" SHALL be replaced by the admin sections, as today, and "Metodología" SHALL still be shown. The link of the current section SHALL be marked as active (`aria-current="page"`).

- "Inicio" SHALL open the start page. It SHALL be active on the start page.
- "Análisis" SHALL resume the flow: it SHALL open the territorial analysis page when an analysis result exists, the polygon validation page when validation results exist, and the stage 1 upload page otherwise. It SHALL be active on every page under `/polygons-validation`, `/territorial-analysis` and `/report-generation`.
- "Metodología" SHALL open the documentation page (`/documentation`) in the current language. It SHALL be active there.

The header SHALL NOT show the former module buttons ("Validación polígonos", "Análisis deforestación", "Generación reporte"); their removal belongs to GC-10.

#### Scenario: Start the analysis from the header

- **WHEN** no farms are loaded and the user clicks "Análisis" on the start page
- **THEN** the browser opens `/polygons-validation/upload-data`

#### Scenario: Resume after an analysis

- **WHEN** an analysis result exists and the user, on the documentation page, clicks "Análisis"
- **THEN** the browser opens `/territorial-analysis`

#### Scenario: Active link

- **WHEN** the user is on `/territorial-analysis/upload-data`
- **THEN** "Análisis" is marked as the current page and "Inicio" and "Metodología" are not

#### Scenario: Admin pages

- **WHEN** a logged-in admin is on `/admin/layers`
- **THEN** the header shows the admin sections and "Metodología", and not "Inicio" or "Análisis"
