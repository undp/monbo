## Context

`LayerTilesOverlay` (`apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.tsx`)
paints the selected layer's tiles over the stage 2 map. Its effect pushes a
`google.maps.ImageMapType` into `map.overlayMapTypes` (line 29) and its cleanup removes it
(lines 31-36):

```ts
const idx = map.overlayMapTypes.getArray().indexOf(overlay);
if (idx > -1) {
  map.overlayMapTypes.removeAt(idx);
}
```

The cleanup runs when the component unmounts (leaving the map view for the table) and whenever
`id`, `version`, `selectedCountry` or `map` change (line 37), i.e. also when the user picks
another layer on the map.

Reproduction (2026-11-25, `dev` at `c202800`, web on `next dev` with
`NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY=invalid-key-mb6-repro`, API on `localhost:8000`):

1. Upload `public/files/examples/es/ejemplo-fincas-con-coordenadas.xlsx`, pick GFW, analyse.
2. "Ver en el mapa": the map shows Google's "Oops! Something went wrong" and the console logs
   `Google Maps JavaScript API error: InvalidKeyMapError`.
3. "Ver tabla": `Uncaught TypeError: Cannot read properties of undefined (reading 'indexOf')`
   and the page becomes "This page couldn't load".

Root cause, checked in the same page after the failure (Maps JS 3.67.1d): Google replaces the
prototype methods of `MVCArray` (`getArray`, `indexOf`, `push`, `removeAt`, `getLength`, …) and of
`Map` (`getZoom`, `fitBounds`, …) with `function(){}`. `getArray()` returns `undefined`, so
`.indexOf` throws. `google.maps.event.removeListener` keeps working and accepts `undefined`
(`function(a){a&&a.remove()}`), and `new google.maps.Circle(...).getBounds()` returns
`undefined`.

`@vis.gl/react-google-maps` 1.10.2 renders its own `AuthFailureMessage` only when its loading
status is `AUTH_FAILURE` (`node_modules/@vis.gl/react-google-maps/dist/index.modern.mjs:730`);
in the reproduction it did not, and the children stayed mounted under Google's error.

## Goals / Non-Goals

**Goals:**

- Leaving the map view, or switching the layer on it, never throws when the Maps API is
  disabled.
- A regression test in the layer that broke (`LayerTilesOverlay`).

**Non-Goals:**

- A message of our own over the failed map (Google's error already shows).
- Hardening `components/reusable/Map.tsx` or `DrawingMap.tsx`: their cleanups did not crash in
  the reproduction (see the proposal's Non-goals).

## Decisions

1. **Guard the cleanup on `getArray()` returning `undefined`.** The cleanup becomes:

   ```ts
   return () => {
     // Google disables its API when it rejects the key: getArray() then returns undefined
     const overlays: google.maps.MapType[] | undefined =
       map.overlayMapTypes.getArray();
     const idx = overlays?.indexOf(overlay) ?? -1;
     if (idx > -1) {
       map.overlayMapTypes.removeAt(idx);
     }
   };
   ```

   The explicit `| undefined` annotation documents that the runtime can break the type
   (`@types/google.maps` types `getArray()` as `T[]`). A disabled map has nothing to clean up:
   its overlays don't render.

   *Rejected:* `try/catch` around the cleanup — it would also swallow a real bug.
   *Rejected:* reading `useApiLoadingStatus()` from vis.gl and skipping the overlay on
   `AUTH_FAILURE` — in the reproduction vis.gl did not reach that status, so it would not fix the
   crash.
   *Rejected:* iterating with `getLength()`/`getAt()` — they are disabled too and return
   `undefined`.

2. **Test with a fake `google` global and a fake map in `GoogleMapsContext`.** jsdom has no
   Google Maps. The test stubs `google.maps.ImageMapType` and `google.maps.Size` with
   `vi.stubGlobal` (the setup already calls `vi.unstubAllGlobals()` after each test,
   `apps/web/src/test/setup.ts:32`) and provides `GoogleMapsContext` (exported by
   `@vis.gl/react-google-maps`, used at `LayerTilesOverlay.tsx:3,13`) with a fake map whose
   `overlayMapTypes` is either a working array or a disabled one whose methods return
   `undefined`, mirroring what Google does.

## Data shape / API contract / cross-stack wiring

N/A: web-only change inside one component's effect; no contract, data or environment change.

## Hazards (Step 2b)

- `apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.tsx`: the cleanup also runs
  on layer/version/country changes (line 37), so the fix must keep removing the old overlay with a
  working API, or the previous layer's tiles would stay painted under the new one. Covered by the
  regression guard below. History: born as `DeforestationMapOverlay.tsx` in the first commit,
  edited in #35 and #131, moved in #54 and renamed to `LayerTilesOverlay.tsx` in #144; the crash
  was first reported in the re-review of #141 (issue #163) and never fixed.
- `apps/web/src/components/page/territorialAnalysis/LayerTilesOverlay.test.tsx` (new): relies on
  the global setup resetting stubbed globals (`src/test/setup.ts:32`) so the fake `google` does
  not leak into other tests; no other known hazard.

## Signal tracing

N/A: the change introduces no signal; it only makes an existing cleanup tolerate a disabled API.

## Risks / Trade-offs

- [Google changes how it disables the API, e.g. throwing instead of returning `undefined`] → the
  test pins today's behaviour; a different failure would surface again as a crash and a new
  report, not as silently wrong data.
- [An overlay pushed before Google disabled the API cannot be removed] → harmless: the map no
  longer renders anything, and the component is unmounting.
