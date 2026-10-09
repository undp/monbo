## Context

`add-frontend-unit-tests` (archived 2026-10-08) set up Vitest + jsdom + Testing Library in `apps/web`, with a shared setup in `src/test/`:

- it mocks `next/navigation` and `file-saver`;
- it fails any request a test didn't stub;
- it resets the runtime config after every test;
- it has typed factories, and `renderHookWithData`, which renders a hook under an injected `DataContext` with the real translations.

That change covered pure logic and the hooks that only read `DataContext`. This one covers what owns state.

- **`DataProvider`** (`src/context/DataContext.tsx`):
  - It polls `GET /countries` and, once a country is chosen, `GET /maps` every `AVAILABLE_MAPS_POLLING_INTERVAL` (5 min).
  - It reads the selected country from `sessionStorage` through `useSyncExternalStore`.
  - It keeps part of its state in module scope: `keptState`, which survives the remount a language change causes, `flowGeneration`, `inMemorySelectedCountry` and the country listeners.
  - `onMapsLoaded` is a `useEffectEvent`. It refreshes the selected layers and invalidates the analysis when a layer's calculation inputs change.
- **`AdminSessionProvider`** (`src/context/AdminSessionContext.tsx`):
  - It restores a token from `sessionStorage` and re-checks it with `GET /admin/session`.
  - It signs out at `expiresAt` with one `setTimeout`.
  - Its `withToken` sends a 401 to the login through `router.replace(localizedPath("/admin", locale))`.
- **`ReportProvider`** (`src/context/ReportContext.tsx`):
  - It reads `useParams().locale`, `DataContext`, and `useVisibleDataForDeforestationPage`.
  - It fetches images through `fetchDeforestationImages`, and renders through a `ReportPdfClient` it creates lazily.
  - It memoizes per selection key with `keyed()`, and turns blobs into URLs with `URL.createObjectURL`.
- **`ReportPdfClient`** (`src/workers/reportPdfClient.ts`) wraps a module `Worker`, and matches responses to requests by id.

**jsdom gaps:** it has no `Worker` and no `URL.createObjectURL` / `revokeObjectURL`.

**Timer behavior:** Vitest's fake timers implement the same rule as browsers and Node: a delay above 2³¹−1 ms becomes 1 ms.

## Goals / Non-Goals

**Goals:**

- Cover the providers' behavior (state transitions, polling, caching, cleanup) through their public context value, the way the pages consume them.
- Fix the admin session expiry for long TTLs, test first.
- Keep every test independent of order, including the new module state.

**Non-Goals:**

- `SnackbarProvider`, `TranslationsProvider`, `RuntimeConfigGate` and UI components.
- Rendering real PDFs or running the real worker. `reportPdf.worker.tsx` stays untested.
- The `react-hooks/set-state-in-effect` warning at `AdminSessionContext.tsx:75`.
- Capping `ADMIN_SESSION_TTL_MINUTES` in the API. A long TTL is valid; the bug is in the browser timer.

## Decisions

### D1: Reset `DataContext`'s module state with an exported function

`DataContext.tsx` exports `resetDataStoreForTests()`. It clears `keptState` and `inMemorySelectedCountry`, and drops the country listeners. The shared setup calls it in `afterEach`, next to `resetRuntimeConfig()`, and also clears `sessionStorage` and `localStorage`. The setup imports `DataContext` inside the hook, not at the top. A top-level import would load `DataContext`, and the `@/api/*` modules it uses, before a test file's `vi.mock` could replace them.

- **`flowGeneration` is not reset.** It only increases, and the code compares it for equality with a value read earlier. Tests do the same: they read it before and compare after.
- **Listeners are dropped** so a provider from a previous test, if one leaked, cannot be notified.

`vi.resetModules()` plus a dynamic import per test was rejected, as in the previous change. Each test would get another `DataContext` instance, and the hooks a provider renders import the original one statically.

### D2: Two ways to mount a provider

- **The real `DataProvider`.** `src/test/renderWithDataProvider.tsx` renders `DataProvider` (with a `locale` prop) under an `I18nextProvider`. It returns `renderHook`'s result for `useContext(DataContext)`, plus `unmount`, and a `remount(locale)` that mounts a fresh provider for the keep-across-remount test. Tests drive it through the context value's setters, wrapped in `act`, as pages do.
- **A provider under the fake context.** `renderHookWithData` gets an optional `wrapper` that is nested inside the fake `DataContext.Provider`. `ReportProvider` is mounted that way, and the test reads `useContext(ReportContext)`. `setContext` + `rerender` change the selection.

### D3: Mocks per test file, with the real error classes

Each provider test mocks the module it goes through with `vi.mock` and `importOriginal`. The error classes stay real, because the providers check them with `instanceof`:

- `@/api/countries`;
- `@/api/deforestationAnalysis`, keeping `MapLayerChangedError`;
- `@/api/adminLayers`, keeping `AdminApiError`;
- `@/utils/deforestationImages`;
- `@/workers/reportPdfClient`, keeping `ReportPdfWorkerTerminatedError`.

The `ReportPdfClient` mock is a class whose `render` and `terminate` are spies shared through `vi.hoisted`, so a test can resolve or reject each render and count instances.

### D4: Fake timers per test, with async advancing

Tests that need time call `vi.useFakeTimers()` themselves:

- the polling of `/maps` and `/countries`;
- the admin session expiry.

The setup's `afterEach` calls `vi.useRealTimers()`. To let a polled response settle, tests use `vi.advanceTimersByTimeAsync`, plus `await act(async () => …)` around it so React flushes the state updates. Tests that only wait for promises use `waitFor` with real timers.

To avoid fighting React 19's scheduling, the fake timers leave `queueMicrotask` and `nextTick` alone (`toFake` lists only the timer functions and `Date`). `Date` is faked so `expiresAt` comparisons move with the clock.

**i18next needs real timers to initialize.** `createTestI18n` hangs if timers are already fake. It now caches one instance per locale for the test file, and the tests that fake timers await `createTestI18n` for their locales first, in `beforeEach`. This was found during implementation. The cache also speeds up the rest of the suite. Tests must not change a cached instance's language.

Tests that don't fake timers (`ReportProvider`, `AdminSessionProvider` outside expiry) use `waitFor`. `waitFor` doesn't advance Vitest's fake timers, so it isn't used together with them.

### D5: Browser APIs jsdom lacks

- **`src/test/objectUrls.ts`:** `stubObjectUrls()` installs `URL.createObjectURL`, returning `blob:test/<n>`, and `URL.revokeObjectURL` as spies, and returns them. It is called by the report tests only. `vi.unstubAllGlobals` doesn't cover properties set on `URL`, so the helper restores them in an `afterEach` it registers.
- **`src/test/fakeWorker.ts`:** a `FakeWorker` class, installed with `vi.stubGlobal("Worker", FakeWorker)`. It records every instance and every `postMessage`. It exposes `reply(data)` to deliver any message (a blob response or an error response), `crash(message)` to fire `onerror`, and `terminated`. `src/test/deferred.ts` gives tests a promise they settle themselves, to control the order of responses.
- **No `new URL(import.meta.url)` workaround is needed.** `ReportPdfClient` builds the worker URL with `new URL("./reportPdf.worker.tsx", import.meta.url)`, which jsdom's `URL` accepts with a `file:` base, and the fake ignores it.

### D6: The admin session expiry fix

The expiry effect schedules the sign-out in steps of at most `MAX_TIMER_DELAY = 2 ** 31 - 1` ms. When a step ends before `expiresAt`, it schedules the next one with the remaining time. When `expiresAt` has passed, it calls `logout`. The cleanup clears whichever step is pending.

- With the default 60-minute TTL there is a single step, the same as today.
- The fix stays inside the existing effect; there is no new state, and no change to the API or its contract.

Two alternatives were rejected:

- **Capping the TTL in the API:** it hides the browser limit behind a configuration rule.
- **Polling the expiry every minute:** extra wakeups for every session, to handle a case that needs one more timer.

### D7: What the tests assert

- **Assert what consumers see.** The tests check the context values the pages read, and the calls made to the boundaries: API, router, storage, worker client. They don't check internal refs.
- **Count calls to prove reuse.** In `ReportProvider`, `fetchDeforestationImages` and `render` are counted. Two renders (preview and complete) and one image fetch per selection is the contract the PDF optimization established.

## Risks / Trade-offs

- **[Fake timers and React 19's scheduler interact badly]** For example, `useEffectEvent` updates that never flush. → Use `advanceTimersByTimeAsync` inside `act`, and fake only the timer functions and `Date`. If a test still hangs, it uses real timers with a shortened poll by mocking `@/config/constants`. That is the fallback, not the plan.
- **[`resetDataStoreForTests` is test-only surface in production code]** → It is one function with a JSDoc saying so, the same trade-off as `resetRuntimeConfig`.
- **[Mocking `ReportPdfClient` hides integration bugs between the provider and the real client]** → The client has its own tests against a fake `Worker`. The real worker (`@react-pdf`) stays untested, as decided.
- **[The expiry fix changes timing code without a browser test]** → Vitest's fake timers reproduce the browser's overflow rule. The test fails before the fix and passes after it, and the default TTL keeps a single timer.

## Migration Plan

The change ships in one PR into `dev`, on a branch based on #66 (`add-frontend-unit-tests`). It is rebased onto `dev` once #66 merges. There is no runtime or deploy migration. Rollback is a revert.

## Open Questions

None.
