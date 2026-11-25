## Context

`DataProvider` (`apps/web/src/context/DataContext.tsx`) is mounted in `app/[locale]/layout.tsx`, so it lives for the whole tab session and survives navigation between pages. It loads two lists with two `useEffect`s:

- `/countries`: on mount and every `AVAILABLE_MAPS_POLLING_INTERVAL` (5 minutes).
- `/maps?country=<selected>`: when a country is selected, on a language or country change, and every 5 minutes. The response goes through `onMapsLoaded`, which refreshes the selected layers, invalidates the analysis when a layer's calculation inputs changed, and deselects hidden layers. An `active` flag in the effect discards responses that arrive after the country changed.

The API side is already fresh: one replica, `write_index` updates the in-memory index cache, and `/maps` has no `Cache-Control`. Each `/maps` call reads every enabled layer's attributes and considerations from the SMB share, which is why the interval is not lowered.

Layer choices for a new analysis are shown in two places, both reading `availableMaps` from the context: `DeforestationModal` (polygon validation page, opened from `PageFooter`) and `DeforestationAnalysisUploadDataPageContent`. `MapSelectionModal` (report generation) lists `deforestationAnalysisParams.selectedMaps`, the layers already analyzed, so a new layer can't show up there without a new analysis.

## Goals / Non-Goals

**Goals:**

- A layer enabled while a user has the app open shows up when the user returns to the tab or opens a layer selector, without a reload.
- A new country (its first layer enabled) shows up on return to the tab.
- On-demand refetches can't turn into a burst of requests.
- Refetched lists go through exactly the same handling as the poll.

**Non-Goals:**

- Push updates (SSE or websockets) from the API.
- Changing the poll interval, or caching metadata in the API.
- Refreshing the report's layer selection (`MapSelectionModal`).
- Refreshing the admin pages, which already reload their own list after each change.

## Decisions

### One fetch function per list, shared by the poll and the on-demand triggers

Move each list's fetch out of its effect into a function that every trigger calls: mount, the poll, the visibility and focus listeners, and the exposed refresh. Use `useEffectEvent` for the maps fetch, as `onMapsLoaded` already does, so it always reads the current `locale` and `selectedCountry` without restarting the interval.

The `active` flag only works inside a single effect. Replace it with a request counter in a ref: each maps request takes the next number, and a response is applied only if its number is still the latest and its country is still the selected one. This keeps the existing guarantee that a late response for the previous country is dropped, and also drops an older response that arrives after a newer one.

*Alternative:* leave the effects as they are and add separate fetches for the new triggers. Rejected: two code paths for the same list would drift apart, and invalidation must behave the same however the list arrived.

### A minimum gap between fetches of the same list

Add `ON_DEMAND_REFRESH_MIN_GAP = 30 seconds` to `config/constants.ts`. Store, per list, when the last fetch started (and for maps, for which country). On-demand triggers skip the fetch when one started less than the gap ago, or when one is still in flight. The poll and a country or language change always fetch (they are already rare, and a country change needs that country's list).

Thirty seconds absorbs the `visibilitychange` + `focus` pair that browsers fire together, quick tab switching, and opening and closing a modal several times. A layer enabled a few seconds before the user opens the selector may still miss that refresh and arrive on the next trigger. That is acceptable compared with the current five minutes.

*Alternative:* debounce the listeners. Rejected: a debounce delays the first refresh, and the gap must also cover the exposed refresh called by the pages.

### Visibility and focus listeners in the provider

Listen to `visibilitychange` on `document` (acting only when `document.visibilityState === "visible"`) and to `focus` on `window`. Each refreshes both lists, subject to the gap. Both events are needed: `visibilitychange` covers tab switches and restoring a minimized window, and `focus` covers coming back from another application with the tab already visible. The poll keeps running in hidden tabs as it does today.

### A refresh function on the context, called by the selectors

Add `refreshAvailableMaps: () => void` to `DataContext`. It refetches the selected country's layers, subject to the gap, and does nothing without a selected country. Callers:

- `DeforestationModal`: in an effect on `isOpen` turning true.
- `DeforestationAnalysisUploadDataPageContent`: on mount.

While the refetch is in flight the selector shows the current list (no loading state). The new layer appears when the response lands, like a poll today.

*Alternative:* refresh inside `useMapsForSelectedCountry`. Rejected: `MapSelectionModal` also uses that hook and must not trigger a fetch. A hook that fetches when it renders also mixes concerns.

## Risks / Trade-offs

- [More `/maps` reads of the SMB share] → bounded by the 30-second gap per list, and only on user actions (returning to the tab, opening a selector).
- [A refetch while the user is choosing layers can deselect a layer an admin just disabled] → same behavior as a poll today. `onMapsLoaded` handles it, and the deselection is the intended rule (a hidden layer is never used for a new analysis).
- [Fake timers in tests also need to control `Date.now` for the gap] → Vitest's `vi.useFakeTimers()` fakes `Date` by default. Tests advance time past the gap explicitly.
- [Listeners leak on remount] → the provider remounts on a language change with `keptState`. The listeners are added and removed in an effect cleanup.

## Migration Plan

Frontend only, no contract change. It ships with the next web deploy. Rollback is reverting the commit.

## Open Questions

- Is 30 seconds the right gap? It could be lower (10 s) if `/maps` stays cheap with few layers per country.
