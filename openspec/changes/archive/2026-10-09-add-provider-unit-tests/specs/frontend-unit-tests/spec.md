## MODIFIED Requirements

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

## ADDED Requirements

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
