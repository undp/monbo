## 1. Regression test (fix tripwire first)

Files: apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.test.tsx

Disjoint from group 2 (test file only).

- [x] 1.1 Create `LayerTilesOverlay.test.tsx` next to the component. Stub `google` with
  `vi.stubGlobal` (`maps.ImageMapType`: a class that keeps its options; `maps.Size`: a class),
  render `LayerTilesOverlay` under `DataContext.Provider` (`makeDataContext` with one selected
  layer from `makeMap` and a `selectedCountry`) and `GoogleMapsContext.Provider` (from
  `@vis.gl/react-google-maps`) holding a fake map. Use `setSearchParams` if the selected layer
  needs it.
- [x] 1.2 **Fix tripwire** — "doesn't throw when unmounted after Google disabled the Maps API":
  the fake map's `overlayMapTypes` has `push`, `removeAt` (a spy) and `getArray` that return
  `undefined`, as Google's disabled `function(){}`. Assert `unmount()` does not throw and
  `removeAt` is not called. Run it against the **unchanged** component first and record that it
  fails with `Cannot read properties of undefined (reading 'indexOf')`.
  Minimal mutant (post-fix, via `falsify.mjs`), in
  `apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.tsx`:
  `--find 'overlays?.indexOf(overlay) ?? -1' --replace 'overlays!.indexOf(overlay)'`.
- [x] 1.3 **Regression guard** — "adds the layer's tiles on mount and removes them on unmount":
  with a working fake `overlayMapTypes` (backed by an array), after render it holds one overlay
  whose `getTileUrl({x: 1, y: 2}, 12)` is
  `http://api.test/layer_analysis/tiles/<country>/<id>/dynamic/12/1/2.png?v=<version>` (check the
  exact base in `config/env.ts` `LAYER_ANALYSIS_TILES_URL`) and whose `getTileUrl(..., 11)` is
  `null`; after `unmount()` the array is empty. Minimal mutant:
  `--find 'map.overlayMapTypes.removeAt(idx);' --replace 'void idx;'`.
- [x] 1.4 **Regression guard** — "replaces the overlay when the layer changes": rerender with
  another selected layer (or version) and assert the array still holds exactly one overlay, the
  new one. Same minimal mutant as 1.3 (`removeAt` → `void idx;`) turns it red (two overlays).

## 2. Fix

Files: apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.tsx

- [x] 2.1 Replace the cleanup at `LayerTilesOverlay.tsx:31-36` with the one in `design.md`
  (Decision 1): read `getArray()` into `overlays: google.maps.MapType[] | undefined`, compute
  `idx` as `overlays?.indexOf(overlay) ?? -1`, keep `removeAt(idx)` under `idx > -1`, with the
  one-line comment on why `getArray()` can be `undefined`. Nothing else in the component changes.
- [x] 2.2 Run the tests of group 1: all green. Run the two mutants of 1.2 and 1.3 with
  `falsify.mjs` and confirm each turns its test red.

## 3. Verification

- [ ] 3.1 In `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`.
- [x] 3.2 `openspec validate fix-map-overlay-without-maps-key --strict`.
- [x] 3.3 By hand (manual, not automatable: it needs Google's real Maps JS rejecting a key): run
  the web with `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=invalid-key`, upload
  `public/files/examples/es/ejemplo-fincas-con-coordenadas.xlsx`, analyse with one layer, open
  "Ver en el mapa", then "Ver tabla": the table shows, no global error page and no
  `reading 'indexOf'` error in the console. Close the browser tab afterwards.
