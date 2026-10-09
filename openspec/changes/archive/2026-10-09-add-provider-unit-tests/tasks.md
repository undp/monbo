## 1. Shared setup and helpers

- [x] 1.1 Export `resetDataStoreForTests()` from `src/context/DataContext.tsx`. It clears `keptState`, sets `inMemorySelectedCountry` to null and clears the country listeners. Add a JSDoc saying it exists for tests (D1)
- [x] 1.2 In `src/test/setup.ts`, after every test (importing `DataContext` lazily, so it doesn't load `@/api/*` before a test file's `vi.mock`):
  - call `resetDataStoreForTests()`;
  - clear `sessionStorage` and `localStorage`;
  - call `vi.useRealTimers()` (D1, D4)
- [x] 1.3 Add an optional `wrapper` to `renderHookWithData`, nested inside the fake `DataContext.Provider` (D2)
- [x] 1.4 Create `src/test/renderWithDataProvider.tsx` (and `src/test/deferred.ts`; `createTestI18n` now caches one instance per locale, because i18next can't initialize under fake timers). It renders the real `DataProvider` with a `locale` under the real translations, and returns the hook result for `useContext(DataContext)`, `unmount`, and `remount(locale)` (D2)
- [x] 1.5 Create `src/test/objectUrls.ts`, with `stubObjectUrls()`: spies for `URL.createObjectURL` (`blob:test/<n>`) and `URL.revokeObjectURL`, restored after the test (D5)
- [x] 1.6 Create `src/test/fakeWorker.ts`. `FakeWorker` records its instances and posted messages, and has `reply` (any message, so a test sends a blob or an error response), `crash` and `terminated`. `installFakeWorker()` stubs the global (D5)
- [x] 1.7 Extend `src/test/setup.test.ts`: storage is empty and timers are real at the start of a test. The kept-flow leak check lives in `DataContext.test.tsx`, where the API is mocked (4.5)

## 2. Admin session: expiry fix (test first)

- [x] 2.1 Write `src/context/AdminSessionContext.test.tsx` with the expiry scenarios from the `admin-authentication` delta. Use fake timers and a mocked `createAdminSession`:
  - a 60-minute session is active at 59 minutes and cleared at 60;
  - a 30-day session is still active after 1 s and after 1 day, and is cleared after 30 days.

  Confirm the 30-day case fails on the current code
- [x] 2.2 In `AdminSessionProvider`, schedule the sign-out in steps of at most `2 ** 31 - 1` ms and re-arm until `expiresAt`. The effect's cleanup clears the pending step (D6)
- [x] 2.3 Run the expiry tests until they pass

## 3. Admin session: the rest

- [x] 3.1 Restoring a session:
  - no stored token: ready, no API call;
  - a valid one is re-checked and takes the API's country;
  - an expired one is removed with no API call;
  - unreadable JSON is removed;
  - `getAdminSession` rejecting removes it
- [x] 3.2 `login` stores the session in `sessionStorage` and exposes it; `logout` removes it
- [x] 3.3 `withToken`:
  - with no session, it replaces the page with the localized login (`/admin` for `es`, `/en/admin` for `en`) and throws `AdminApiError` 401;
  - a 401 from the call clears the session, goes to the login and rethrows;
  - a 409 is rethrown and the session is kept;
  - success passes the token to the call and returns its result

## 4. DataProvider

- [x] 4.1 `src/context/DataContext.test.tsx`, countries:
  - the first `/countries` response fills `availableCountries` and sets `availableCountriesLoaded`;
  - a failure before any list sets `availableCountriesError`;
  - a failed refresh keeps the list
- [x] 4.2 Stored country:
  - `setSelectedCountry` writes `sessionStorage` and updates the value;
  - a stored country missing from the first `/countries` response is dropped and the flow reset, once per mount;
  - the legacy `localStorage` key is removed on mount
- [x] 4.3 Layers:
  - `/maps` is requested only once a country is selected, and polled every 5 minutes;
  - `availableMaps` shows only the current country's list;
  - `availableMapsError` is set only while the current country has no list;
  - a response for the previous country, arriving after the change, is ignored
- [x] 4.4 Polling with a selected layer:
  - a new `version` (and separately `pixelSize`, `baseline`, `comparedAgainst`) with results invalidates the analysis: results null, report layers, farms and download type cleared, `analysisOutdated` true, the selected layer refreshed;
  - a name-only change refreshes without invalidating;
  - a hidden layer is kept with results and deselected without them
- [x] 4.5 Flow:
  - `resetAnalysis` clears farms, results and params, resets `analysisOutdated`, and increases `readFlowGeneration()` (compared to the value before);
  - `invalidateAnalysis` keeps the farms;
  - farms survive an unmount and a remount with another locale;
  - `selectedMaps` is returned sorted by id

## 5. ReportProvider

- [x] 5.1 `src/context/ReportContext.test.tsx`, with mocked `fetchDeforestationImages` and `ReportPdfClient` (D3), stubbed object URLs, `setParams({ locale: "es" })` and a runtime config. Without a selection: `previewUrl` is null, `isPreviewLoading` false, and `getCompleteReport` and `getSeparatedReports` reject
- [x] 5.2 With a selection:
  - images are fetched once;
  - the preview renders `complete` without links, then the complete report renders with links;
  - `previewUrl` is set and `isPreviewLoading` goes false;
  - each request carries the locale and the runtime config
- [x] 5.3 Reuse:
  - `getCompleteReport` returns the pre-render without a new render;
  - `getSeparatedReports` renders `perFarm` with the same images;
  - the same farms in another order cause no new fetch;
  - another selection fetches again and revokes the previous preview URL
- [x] 5.4 Failures:
  - a failed preview render sets `previewFailed`, and `retryPreview` renders again;
  - `MapLayerChangedError` from the image fetch calls `invalidateAnalysis`, and `previewFailed` stays false;
  - `ReportPdfWorkerTerminatedError` is ignored
- [x] 5.5 Unmount:
  - the client is terminated and the preview URL revoked;
  - unmounting while images are being fetched creates no client

## 6. ReportPdfClient

- [x] 6.1 `src/workers/reportPdfClient.test.ts`, with `FakeWorker`:
  - no worker until the first render, and one worker for several renders;
  - out-of-order responses resolve their own promises;
  - an error response rejects with its message
- [x] 6.2 A crash (`onerror`) rejects every pending render and the next render creates a new worker. `terminate` rejects pending renders with `ReportPdfWorkerTerminatedError`, and the next render creates a new worker

## 7. Documentation

- [x] 7.1 Update the Testing section of `apps/web/README.md`:
  - the providers are covered;
  - the new helpers (`renderWithDataProvider`, the `wrapper` option, `FakeWorker`, `stubObjectUrls`);
  - fake timers per test;
  - the DataContext reset
- [x] 7.2 Add CHANGELOG entries under `[Unreleased]`:
  - Added: provider and worker-client tests;
  - Fixed: an admin session with a TTL above ~24.8 days no longer ends right after login

## 8. Verification

- [x] 8.1 Run `pnpm test` (also twice with `--sequence.shuffle`), `pnpm exec tsc --noEmit`, `pnpm run lint` and `pnpm run build` in `apps/web`. All pass, and lint shows no new warnings
- [x] 8.2 Run `openspec validate add-provider-unit-tests --strict` and fix any finding
