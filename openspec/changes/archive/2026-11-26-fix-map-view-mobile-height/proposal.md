## Why

Below the `md` breakpoint the results map (`?view=map`) is blank: its container gets only
`minHeight: { xs: 360, md: 0 }` and `flex: 1` (`apps/web/src/components/page/territorialAnalysis/MapView.tsx:196-201`),
and the map inside uses `height: "100%"` (`SelectedPolygonsMap.tsx:108`). A percentage height
doesn't resolve against a `min-height` in an auto-height column, so the map measures 0 px.
Found in the browser on 2026-11-26 at 390×844 during MB-8's 390 px check (PR #183): container
360 px tall, Google Maps region 0 px; at 1280×800 the map measures 614 px. The user approved
fixing it in the same PR (2026-11-26).

## What Changes

- Below `md`, the map container has a fixed height of 360 px and doesn't flex
  (`flex: { xs: "none", md: 1 }`, `height: { xs: 360, md: "auto" }`), so the map fills it. From
  `md` up, the layout is unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `territorial-analysis`: adds a requirement that the results map is visible on a narrow screen.

## Impact

- Web only: `MapView.tsx` and `MapView.test.tsx`. No API or contract change.

## Non-goals

- Any other layout change of the map view (the farm list was checked and is fine).
