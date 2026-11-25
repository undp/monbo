## MODIFIED Requirements

### Requirement: Pure logic is covered

The suite SHALL cover the web's framework-independent logic:

- percentage, number, area and coordinate formatting (`utils/numbers`, `utils/polygons`), in both supported languages;
- the overlap threshold check (`utils/overlap`);
- the classification of layer results by polarity, threshold and missing data (`utils/layerResults`);
- string and date helpers (`utils/strings`, `utils/dates`);
- layer labels (`utils/layerLabel`);
- the GeoJSON export (`utils/geojson`);
- upload-row validation (`excel.validateData`).

Formatting assertions SHALL state the expected text for each language, not reproduce the formatting logic.

#### Scenario: Upload validation reports the template row

- **WHEN** `validateData` receives a first data row without a producer name, in Spanish
- **THEN** it returns the mandatory-data message for the "nombre productor" header at row 4, the first data row after the template's three header rows

#### Scenario: Invalid coordinates are rejected

- **WHEN** a row declares `GeoJSON` and `Polygon` but its coordinates are not a GeoJSON polygon
- **THEN** `validateData` returns the invalid-coordinates message for that row

#### Scenario: Classification covers both polarities and no data

- **WHEN** the classification tests run
- **THEN** they cover polarity `avoid` and `required`, a value exactly on the threshold, and a `null` value

### Requirement: Hooks that read the data context are covered

The suite SHALL cover the hooks that derive values from `DataContext` without owning state: `useVisibleDataForAnalysisPage`, `useValidFarmsDataForValidationPage`, `useNoObservationsCountByMap`, `useCountryChange`, `useModuleRouter`, `useMapsForSelectedCountry`, `useAvailableCountries` and `useSelectedMap` (in `useSelectedMapName.tsx`), plus the context-free `useSearch` and `useSortedTable`. These hooks SHALL be tested with an injected context value built by a shared helper, not with the real `DataProvider`.

#### Scenario: Invalid farms are hidden when the analysis covers valid polygons

- **WHEN** the context has three farms, one of them `NOT_VALID`, deforestation results for them, and `polygonsSubset` is `"valid"`
- **THEN** `useVisibleDataForAnalysisPage` returns the two other farms, and only their results

#### Scenario: Country change after an analysis waits for confirmation

- **WHEN** `useCountryChange` requests another country while deforestation results exist
- **THEN** the country is not changed and the requested one is pending
- **AND** confirming resets the analysis, sets the country and navigates to `/home`

#### Scenario: Module navigation without data goes to the upload page

- **WHEN** `useModuleRouter("/polygons-validation")` navigates and no farms are loaded
- **THEN** the router is asked for `/polygons-validation/upload-data`
