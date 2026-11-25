## ADDED Requirements

### Requirement: Web unit-test toolchain

`apps/web` SHALL have a unit-test suite run by Vitest in a jsdom environment, with `@testing-library/react` for hooks. `pnpm test` in `apps/web` SHALL run the whole suite once and exit non-zero if any test fails. The root `pnpm test` SHALL run the API suite and the web suite. Test files SHALL import the test API from `vitest` explicitly, with no injected globals, and SHALL be type-checked by the same `tsc --noEmit` that checks the application. Tests SHALL resolve the `@/` import alias the same way as the application.

#### Scenario: Running the web suite

- **WHEN** a developer runs `pnpm test` in `apps/web`
- **THEN** Vitest runs every `*.test.ts` and `*.test.tsx` file under `src/` once, without watch mode
- **AND** the command exits non-zero if any test fails

#### Scenario: Running every suite from the root

- **WHEN** a developer runs `pnpm test` at the repository root
- **THEN** the API's pytest suite and the web's Vitest suite both run

#### Scenario: A type error in a test fails the type-check

- **WHEN** a test file passes a value of the wrong type to the code under test
- **THEN** `tsc --noEmit` in `apps/web` fails

### Requirement: Tests do not reach the network or depend on order

Web unit tests SHALL NOT make network requests. A shared setup SHALL make any request a test did not stub fail that test, and SHALL replace the Next.js router (`next/navigation`) and file saving (`file-saver`) with test doubles. A test that exercises code calling the API (`@/api/*`) SHALL replace those modules with test doubles. Module-level state that the code under test reads, such as the runtime configuration loaded from `GET /config`, SHALL be reset between tests, so each test passes when run alone or in any order.

#### Scenario: Runtime configuration does not leak between tests

- **WHEN** one test loads a runtime configuration with a deforestation threshold of 1 and the next test loads none
- **THEN** reading a threshold in the next test fails with the "read before GET /config loaded" error, as it does in the application

#### Scenario: An unstubbed request fails the test

- **WHEN** code under test calls `fetch` and the test did not stub it
- **THEN** the test fails with an error naming the requested URL

#### Scenario: Navigation is observable

- **WHEN** a hook under test navigates
- **THEN** the test can assert the path passed to the router's `push`, without a Next.js runtime

### Requirement: Pure logic is covered

The suite SHALL cover the web's framework-independent logic:

- percentage, number, area and coordinate formatting (`utils/numbers`, `utils/polygons`), in both supported languages;
- threshold checks (`utils/deforestation`);
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

### Requirement: The upload templates parse

The suite SHALL read the upload templates served to users (`public/files/m1-upload-file-template-en.xlsx` and `-es.xlsx`) through `loadExcelFileFarmsData`, the same function the upload page uses. Every header in each template's header row SHALL map to a known farm attribute, the example row SHALL NOT be returned as a farm, and farm rows added after it SHALL be returned with their fields mapped.

#### Scenario: Empty template

- **WHEN** an unmodified template is loaded, in its own language, with a selected country
- **THEN** no farms and no error messages are returned

#### Scenario: Filled template

- **WHEN** a template gets one complete farm row after the example row, with two documents
- **THEN** one farm is returned with its producer, production date as an ISO string, coordinates and both documents, and no error messages

#### Scenario: A template header stops matching

- **WHEN** a header in a template is renamed so that no attribute recognizes it
- **THEN** the template test fails

### Requirement: Translation namespaces stay in parity

For every translation namespace, the English and Spanish files SHALL define the same set of keys, nested keys included. The suite SHALL fail and name the missing keys when they differ.

#### Scenario: A key added in one language only

- **WHEN** a key is added to `src/locales/en/common.json` and not to `src/locales/es/common.json`
- **THEN** the parity test fails and names that key and namespace

### Requirement: Hooks that read the data context are covered

The suite SHALL cover the hooks that derive values from `DataContext` without owning state: `useVisibleDataForDeforestationPage`, `useValidFarmsDataForValidationPage`, `useDeforestationFreeResultsCountByMap`, `useCountryChange`, `useModuleRouter`, `useMapsForSelectedCountry`, `useAvailableCountries` and `useSelectedMap` (in `useSelectedMapName.tsx`), plus the context-free `useSearch` and `useSortedTable`. These hooks SHALL be tested with an injected context value built by a shared helper, not with the real `DataProvider`.

#### Scenario: Invalid farms are hidden when the analysis covers valid polygons

- **WHEN** the context has three farms, one of them `NOT_VALID`, deforestation results for them, and `polygonsSubset` is `"valid"`
- **THEN** `useVisibleDataForDeforestationPage` returns the two other farms, and only their results

#### Scenario: Country change after an analysis waits for confirmation

- **WHEN** `useCountryChange` requests another country while deforestation results exist
- **THEN** the country is not changed and the requested one is pending
- **AND** confirming resets the analysis, sets the country and navigates to `/home`

#### Scenario: Module navigation without data goes to the upload page

- **WHEN** `useModuleRouter("/polygons-validation")` navigates and no farms are loaded
- **THEN** the router is asked for `/polygons-validation/upload-data`
