## ADDED Requirements

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
