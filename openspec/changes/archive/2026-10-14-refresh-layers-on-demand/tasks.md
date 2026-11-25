## 1. Shared fetch path in DataProvider

- [x] 1.1 Add `ON_DEMAND_REFRESH_MIN_GAP` (30 seconds) to `apps/web/src/config/constants.ts`
- [x] 1.2 Move the `/countries` fetch out of its effect into a function used by mount and the poll, recording when each fetch starts and whether one is in flight
- [x] 1.3 Move the `/maps` fetch into a `useEffectEvent` used by the country/language effect and the poll, recording the start time, the country and the in-flight state
- [x] 1.4 Replace the effect's `active` flag with a request counter in a ref: apply a `/maps` response only if it is the latest request and its country is still selected
- [x] 1.5 Add the on-demand wrappers that skip a fetch while one is in flight or when one started less than the gap ago (for maps, for the same country); the poll and country/language changes keep fetching unconditionally

## 2. On-demand triggers

- [x] 2.1 In `DataProvider`, listen to `visibilitychange` (only when `document.visibilityState === "visible"`) and to window `focus`, refreshing both lists through the on-demand wrappers; remove the listeners in the effect cleanup
- [x] 2.2 Expose `refreshAvailableMaps` on `DataContext` (default no-op in the context's initial value) and include it in the memoized value
- [x] 2.3 Call `refreshAvailableMaps` in `DeforestationModal` when `isOpen` turns true
- [x] 2.4 Call `refreshAvailableMaps` on mount in `DeforestationAnalysisUploadDataPageContent`
- [x] 2.5 Confirm `MapSelectionModal` is left unchanged (it lists analyzed layers, not `/maps`)

## 3. Tests

- [x] 3.1 In `DataContext.test.tsx`, cover: returning to the tab refreshes both lists; `visibilitychange` + `focus` together cost one request per list; a hidden tab does not refresh
- [x] 3.2 Cover `refreshAvailableMaps`: skipped within the gap, skipped while a fetch is in flight, and a refreshed layer at a new version invalidates the analysis
- [x] 3.3 Check that the existing poll, late-response and remount tests still pass with the request counter
- [x] 3.4 Run `pnpm` test, type-check and lint for `apps/web`

## 4. Manual check

- [x] 4.1 With the app open on the upload page for a country, enable a layer in the admin, switch to another tab for over 30 seconds, come back, and confirm the layer is listed without a reload
- [x] 4.2 With the polygon validation page open, enable a layer and open the deforestation modal after 30 seconds; confirm the layer appears
