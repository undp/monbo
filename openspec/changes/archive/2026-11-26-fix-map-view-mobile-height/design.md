## Context

`MapView.tsx:106-125` stacks list and map in a column below `md` and side by side from `md`. The
map container (`:196-201`) is `flex: 1`, `minWidth: 0`, `minHeight: { xs: 360, md: 0 }`,
`position: relative`; `SelectedPolygonsMap` fills it with `height: "100%"`
(`SelectedPolygonsMap.tsx:108`). In the column, the container's height comes from the flex
algorithm against an auto-height parent, which is not definite, so the child's 100% resolves to
`auto` → 0 px. Measured 2026-11-26: 390×844 → container 360 px, map region 0 px; 1280×800 → map
614 px.

## Goals / Non-Goals

**Goals:** a visible 360 px map below `md`; desktop unchanged. **Non-Goals:** other layout work.

## Decisions

1. `sx` of the map container becomes `flex: { xs: "none", md: 1 }`,
   `height: { xs: 360, md: "auto" }`, `minHeight: { md: 0 }`, keeping `minWidth: 0` and
   `position: "relative"`. With `flex: none` the item's height is its definite `height`, so the
   child's 100% resolves. From `md` the row's stretch alignment gives the item a definite height,
   as today.
   - Rejected: `height: 360` while keeping `flex: 1` — with a 0 basis in an auto-height column the
     flexed size is still not definite. Rejected: changing `SelectedPolygonsMap` — it is shared and
     correct when its parent has a definite height.
2. Test: jsdom has no layout and doesn't apply `@media` rules, so the unit test pins the base
   (mobile-first) style: the map container's computed `height` is `360px` and `flex-grow` is `0`.
   The real layout is verified by hand in a browser at 390×844 and 1280×800.

API contract / data shape / cross-stack wiring: N/A — web layout only.
Signal tracing: N/A — no signal.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `MapView.tsx` | Changing the container's flex at `md` would break the desktop map height | `MapView.tsx:106-125,196-201`; 614 px measured at 1280×800 |
| `MapView.test.tsx` | Renders without a layout engine; only base styles are observable | `MapView.test.tsx:58-71` |
