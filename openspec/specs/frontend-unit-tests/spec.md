# frontend-unit-tests Specification

## Purpose
The web's unit-test suite: Vitest in jsdom, run by `pnpm test` and in CI. It covers the framework-independent logic, the upload templates users download, en/es translation parity and the hooks that read `DataContext`, without reaching the network and without depending on test order.
## Requirements
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

Web unit tests SHALL NOT make network requests. A shared setup SHALL make any request a test did not stub fail that test, and SHALL replace the Next.js router (`next/navigation`) and file saving (`file-saver`) with test doubles. A test that exercises code calling the API (`@/api/*`) SHALL replace those modules with test doubles. Module-level state that the code under test reads SHALL be reset between tests, so each test passes when run alone or in any order. That state includes:

- the runtime configuration loaded from `GET /config`;
- the analysis flow `DataContext` keeps across remounts;
- the in-memory selected country and its subscribers;
- the browser storage.

Fake timers SHALL be enabled per test, only by the tests that need them.

#### Scenario: Runtime configuration does not leak between tests

- **WHEN** one test loads a runtime configuration with a deforestation threshold of 1 and the next test loads none
- **THEN** reading a threshold in the next test fails with the "read before GET /config loaded" error, as it does in the application

#### Scenario: The kept analysis flow does not leak between tests

- **WHEN** one test loads farms into a mounted `DataProvider` and the next test mounts a new one
- **THEN** the new provider starts with no farms, no selected country and empty session storage

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

### Requirement: The data provider is covered

The suite SHALL mount the real `DataProvider`, with `getCountries` and `getMaps` replaced by test doubles and fake timers driving the layer polling. It SHALL cover:

- **Analysis invalidation:** a polled layer whose calculation inputs changed invalidates the analysis. Those inputs are `version`, `pixelSize`, `baseline` and `comparedAgainst`.
- **Layer refresh:** metadata-only changes refresh the selection without invalidating it.
- **Hidden layers:** a hidden layer is kept while an analysis uses it, and deselected otherwise.
- **The stored country:** one that no longer has layers is dropped once per mount.
- **Error states:** the countries and layers error states, a failed refresh, and responses that arrive after the country changed.
- **The flow:** it is kept across a remount, and `resetAnalysis` clears it.

#### Scenario: A new raster invalidates the analysis

- **WHEN** analysis results exist for layer 1 at version 1 and the next poll of `/maps` returns layer 1 at version 2
- **THEN** the results are cleared, the report's selected layers, farms and download type are cleared, and `analysisOutdated` is true
- **AND** the selected layer carries version 2

#### Scenario: A renamed layer is refreshed without invalidating

- **WHEN** analysis results exist and the next poll returns the selected layer with only a new name
- **THEN** the results are kept and the selected layer carries the new name

#### Scenario: A hidden layer

- **WHEN** the next poll no longer lists a selected layer
- **THEN** the layer stays selected if analysis results exist, and is deselected if they don't

#### Scenario: A stored country without layers

- **WHEN** the session storage holds `PE` and the first `/countries` response doesn't include it
- **THEN** the selected country becomes null and the analysis flow is reset

#### Scenario: A late response for the previous country

- **WHEN** the selected country changes from `CR` to `PE` while `/maps` for `CR` is still pending, and that response then arrives
- **THEN** the available layers stay those of `PE`

#### Scenario: The flow survives a language change

- **WHEN** farms are loaded, the provider unmounts, and it mounts again with another locale
- **THEN** the farms are still loaded

### Requirement: The admin session provider is covered

The suite SHALL cover `AdminSessionProvider` with the admin API module replaced by test doubles, keeping `AdminApiError` real. It SHALL cover:

- **Restoring a stored session:** valid, expired, unreadable, or rejected by `GET /admin/session`.
- **Login and logout.**
- **Expiry,** with fake timers.
- **`withToken`:** with no session, with a 401 response, and with any other error.

#### Scenario: A stored token is re-checked

- **WHEN** the session storage holds an unexpired session and `GET /admin/session` confirms it
- **THEN** the provider becomes ready with that session and the country the API returned

#### Scenario: An expired stored token is dropped without a request

- **WHEN** the session storage holds a session whose `expiresAt` has passed
- **THEN** the provider becomes ready with no session, removes the stored token, and makes no API call

#### Scenario: A 401 sends the admin to the login

- **WHEN** a call made through `withToken` fails with a 401 on the English pages
- **THEN** the session is cleared, the router replaces the page with `/en/admin`, and the error is rethrown

#### Scenario: Other errors keep the session

- **WHEN** a call made through `withToken` fails with a 409
- **THEN** the error is rethrown and the session is kept

### Requirement: The report provider and its worker client are covered

The suite SHALL cover `ReportProvider` under an injected `DataContext`. Image fetching and the PDF worker client SHALL be replaced by test doubles, and `URL.createObjectURL` and `URL.revokeObjectURL` stubbed. It SHALL cover:

- **The first render:** each selection's images are fetched once; the preview renders without links and the complete report with links.
- **Reuse:** the download reuses the pre-rendered complete report, and the separated reports reuse the images.
- **Selection keys:** the same farms in another order are the same selection; another selection fetches again and releases the previous preview URL.
- **Failures:** a failed render can be retried, and a changed layer invalidates the analysis.
- **Unmount:** the worker client is terminated and the preview URL released.

The suite SHALL cover `ReportPdfClient` with a fake `Worker`:

- the worker is created lazily, and only once;
- responses are matched to requests by id;
- an error response, a crashed worker and `terminate` each reject what was pending.

#### Scenario: The download reuses the pre-render

- **WHEN** the preview of a selection has rendered and the user asks for the complete report
- **THEN** no new render starts: the images were fetched once and the worker client rendered twice (preview and complete)

#### Scenario: A failed preview can be retried

- **WHEN** the preview render fails and `retryPreview` is called
- **THEN** `previewFailed` is true until the retry, and the retry renders the preview again

#### Scenario: A changed layer during the report

- **WHEN** fetching the report images fails with `MapLayerChangedError`
- **THEN** `invalidateAnalysis` is called and `previewFailed` stays false

#### Scenario: Out-of-order worker responses

- **WHEN** two renders are requested and the worker answers the second one first
- **THEN** each promise resolves with its own blob

#### Scenario: A crashed worker

- **WHEN** the worker fires an error while two renders are pending, and a third render is requested afterwards
- **THEN** both pending renders reject, and the third creates a new worker

