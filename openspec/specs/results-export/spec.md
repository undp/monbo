# results-export Specification

## Purpose
How the web writes the results of "Polygon validation" and "Deforestation analysis" to Excel: in the upload template's columns, so each value sits under its header and a downloaded file can be uploaded again.
## Requirements
### Requirement: Excel exports follow the upload template

The Excel exports of "Polygon validation" and "Deforestation analysis" SHALL start with the upload template's 3 header rows, in the user's language. Each farm SHALL then be written as one row whose first columns are the template's columns, in the template's order, each value under its header. The coordinates format SHALL be `GeoJSON`. The geometry type SHALL be `Point` or `Polygon`. The coordinates SHALL be the farm's GeoJSON coordinates array: `[lng, lat]` for a point, and the polygon's rings for a polygon. Columns that only the export has SHALL come after the template's columns, with their own headers.

#### Scenario: Values under their headers

- **WHEN** a farm with a region, a polygon and an area is exported from "Polygon validation"
- **THEN** its region is under "Región"/"Region", `GeoJSON` under the coordinates format, `Polygon` under the geometry type, its coordinates under the land coordinates and its area under the area, and its validation result under "Resultado Validación"

#### Scenario: Deforestation export header rows

- **WHEN** the results of "Deforestation analysis" are exported
- **THEN** the sheet starts with the template's 3 header rows, and the first farm is on row 4

#### Scenario: Overlap percentage

- **WHEN** an overlap between two farms is exported in the inconsistencies sheet
- **THEN** its percentage is in the column headed "Porcentaje de Traslape"/"Overlap Percentage", merged across the two farms' rows

### Requirement: Excel exports can be uploaded again

An Excel export SHALL be readable as a farms file in the same language: uploading it SHALL give back the same farms, with the same ID, producer, production date, quantity, unit, region, crop, association, documents and geometry. A point's area SHALL come back as it was, not rounded: an upload takes a zero area as missing and gives the point the default 1 ha. Production quantity and area SHALL be written as numeric cells, so they don't depend on the language's decimal separator.

#### Scenario: Spanish export uploaded again

- **WHEN** a polygon farm with a production of 1200.5 kg and a point farm of 2.5 ha are exported in Spanish, and the file is uploaded in Spanish
- **THEN** both farms parse with no errors, with 1200.5 as the quantity, the same polygon, and 2.5 ha for the point

#### Scenario: English export uploaded again

- **WHEN** the same farms are exported and uploaded in English
- **THEN** they parse with no errors and the same values

### Requirement: Layer results are exported by category and layer

The Excel export of the layer analysis SHALL write, after the template's columns, two columns per analysed layer, in the order of the categories of `GET /categories` and then of the layers: the finding percentage and the result label. Their headers SHALL be in the user's language and name the layer's category and the layer (for example "Frontera agrícola · UPRA 2023 — % hallazgo" and "Frontera agrícola · UPRA 2023 — Resultado"). The values SHALL follow the report's classification (see `category-report`): the category's `ok` or `flagged` label, and the finding, which in the Excel SHALL be a numeric cell in percent (rounded to 4 decimals), so it can be sorted and filtered the same in any language. A `null` or missing result SHALL be "Sin dato" / "No data", as text, in both columns. The columns SHALL cover every analysed layer, also one whose category is no longer among the country's categories (disabled or broken after the analysis): its results are "No data" and its category is named "Sin categoría" / "No category". The sheet's name SHALL be in the user's language. The GeoJSON export SHALL add the same two values per layer to each feature's properties, under the same localized names, with the finding as formatted text ("18%", "< 2%").

#### Scenario: English Excel

- **WHEN** the layer results are exported to Excel with the interface in English
- **THEN** every results header and the sheet name are in English, and each names its category and layer

#### Scenario: Spanish GeoJSON

- **WHEN** the layer results are exported to GeoJSON with the interface in Spanish
- **THEN** each feature has, per layer, a property for the finding percentage and one for the result, named in Spanish with the category and the layer

#### Scenario: Null result

- **WHEN** a farm's result for a layer is `null`
- **THEN** both of that layer's columns say "Sin dato" in Spanish ("No data" in English), and the farm's row is still exported

#### Scenario: Required category

- **WHEN** a farm's result for a `required` layer with threshold 5 is `0.82`
- **THEN** its finding cell is the number 18 and its result cell the category's flagged label

#### Scenario: Layer whose category was disabled

- **WHEN** a layer was analysed and its category is disabled before the export
- **THEN** the Excel and the GeoJSON still have its two columns, named after "Sin categoría", with "Sin dato" for every farm

#### Scenario: Export can still be uploaded

- **WHEN** a layer-results export is uploaded again as a farms file
- **THEN** the farms parse as before: the result columns come after the template's columns and are ignored

