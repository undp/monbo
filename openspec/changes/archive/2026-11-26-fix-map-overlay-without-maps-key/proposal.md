## Why

With a missing or invalid Google Maps key, leaving the stage 2 map view (back to the table, or
switching the layer on the map) replaces the whole page with the global error page:
`TypeError: Cannot read properties of undefined (reading 'indexOf')`. Reproduced on 2026-11-25
against `dev` (`c202800`) with `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=invalid-key-mb6-repro`
(issue #163, unit MB-6 of #172). A missing key is the same case: `config/env.ts:1-5` falls back to
the `__NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY__` placeholder, which Google rejects as an invalid
key.

When Google rejects the key it disables its own API: the methods of `MVCArray`, `Map`,
`Polygon` and others become `function(){}` and return `undefined` (checked in the browser on Maps
JS 3.67.1d). The overlay's effect cleanup
(`apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.tsx:31-36`) calls
`map.overlayMapTypes.getArray().indexOf(overlay)`, so it throws on unmount and React tears the
page down. The user loses the results table, which works without a map.

## What Changes

- The tiles overlay's cleanup treats a disabled Maps API (`getArray()` returning `undefined`) as
  "nothing to remove" instead of throwing.
- A regression test for `LayerTilesOverlay`: unmounting under a disabled Maps API does not throw,
  and with a working API the overlay is still added on mount and removed on unmount.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `territorial-analysis`: adds a requirement that the stage 2 map view survives a Google Maps key
  that is missing or invalid (the map shows Google's error, the table keeps working).

## Non-goals

- A localized message of our own over the failed map. Google's own error ("Oops! Something went
  wrong. This page didn't load Google Maps correctly.") already shows, which is what #163
  expects.
- Hardening the rest of `components/reusable/Map.tsx` or the drawing map
  (`components/page/uploadData/manualFarm/DrawingMap.tsx`). With the same invalid key, entering
  and leaving the drawing map did not crash (twice, including with the API already disabled), and
  `Map.tsx`'s cleanups go through `google.maps.event.removeListener`, which accepts `undefined`,
  and `getBounds()`'s result is already checked (`Map.tsx:121-125`).
- Validating the key at startup or hiding the map view when there is no key.

## Impact

- Web only: `apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.tsx` and a new
  `LayerTilesOverlay.test.tsx` next to it.
- No API, contract, i18n or environment variable change.
- `MapView.tsx` is not touched, so MB-8 (#168) has no conflict with this change.
