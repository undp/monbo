## Why

`add-frontend-unit-tests` covered the web's pure logic and the hooks that read `DataContext`, but left out the providers that own the state. That is where the riskiest behavior lives:

- **`DataProvider`** polls `/maps` every 5 minutes. It invalidates an analysis whose layer got a new raster, and deselects hidden layers. It drops a stored country that lost its layers, and keeps the flow across a language change.
- **`AdminSessionProvider`** restores, re-checks and expires the admin session, and sends a 401 back to the login.
- **`ReportProvider`** fetches each report's images once and shares one worker render between the preview and the download. That reuse was the whole point of the PDF optimization (#65).

None of this is tested.

Exploring it surfaced a bug. `AdminSessionProvider` schedules the sign-out with `setTimeout(logout, expiresAt - now)`. Browsers and Node treat a delay above 2³¹−1 ms (about 24.8 days) as immediate. The API accepts any positive `ADMIN_SESSION_TTL_MINUTES` (default 60), so a TTL over ~35,800 minutes would sign the admin out as soon as they log in.

## What Changes

- **Tests for `DataProvider`**, mounted for real, with the API modules mocked and fake timers for the polling:
  - analysis invalidation when a selected layer's calculation inputs change;
  - hidden and refreshed layers;
  - the stored country, and the error states;
  - stale responses;
  - the flow kept across a remount;
  - `resetAnalysis` and the session storage.
- **A reset for `DataContext`'s module state** (`keptState`, the in-memory selected country and its listeners). The shared setup runs it after every test, like `resetRuntimeConfig`.
- **Tests for `AdminSessionProvider`:**
  - restoring a stored token (valid, expired, unreadable, rejected by the API);
  - login and logout;
  - expiry;
  - `withToken` with no session, a 401 or another error.
- **Fix the long-session expiry.** The timer is capped at the maximum delay and re-armed until the real expiry. The test is written first and fails on the current code.
- **Tests for `ReportProvider`**, under an injected `DataContext`:
  - images fetched once per selection;
  - the preview, then the complete report pre-rendered and reused by the download;
  - the separated reports reuse the same images;
  - retry after a failed render;
  - a changed layer invalidates the analysis;
  - cleanup on unmount.
- **Tests for `ReportPdfClient`** with a fake `Worker`:
  - one worker, created lazily;
  - responses matched by id;
  - errors, a crashed worker, and terminate.
- **Test helpers:**
  - an extra wrapper for `renderHookWithData`;
  - a helper that mounts the real `DataProvider`;
  - a fake `Worker`;
  - object-URL stubs, because jsdom has none.

Out of scope:

- `SnackbarProvider`.
- The `react-hooks/set-state-in-effect` warning at `AdminSessionContext.tsx:75`, left as it is.
- Component tests, E2E, coverage reports.
- Promoting the `react-hooks` rules back to `error`. Only 1 of the 18 warnings is in a provider; the other 17 are in components.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-unit-tests`: the suite covers the context providers and `ReportPdfClient`, and resets `DataContext`'s module state between tests.
- `admin-authentication`: the frontend session ends at its expiry and not before, whatever the TTL.

## Impact

- **Web:**
  - new test files for the three providers and `ReportPdfClient`;
  - new helpers in `src/test/`;
  - `src/context/DataContext.tsx` exports a reset for tests;
  - `src/context/AdminSessionContext.tsx` (the expiry fix).
- **Docs:** `apps/web/README.md` (Testing: what is covered, the new helpers) and `CHANGELOG.md` (Added: tests; Fixed: the admin session expiry).
- **API, CI, dependencies:** none. The suite runs in the existing "Tests, type-check, lint, build" job.
- **Users:** none with the default TTL. With a TTL over ~24.8 days, admins are no longer signed out right after logging in.
