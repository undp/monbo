## MODIFIED Requirements

### Requirement: Hooks that read the data context are covered

The suite SHALL cover the hooks that derive values from `DataContext` without owning state: `useVisibleDataForAnalysisPage`, `useValidFarmsDataForValidationPage`, `useNoObservationsCountByMap`, `useCountryChange`, `useModuleRouter`, `useAvailableCountries` and `useSelectedMap` (in `useSelectedMapName.tsx`), plus the context-free `useSearch` and `useSortedTable`. These hooks SHALL be tested with an injected context value built by a shared helper, not with the real `DataProvider`.

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
