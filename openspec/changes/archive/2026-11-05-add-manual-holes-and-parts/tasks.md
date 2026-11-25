## 1. Drawing rules (`utils/drawing.ts`)

- [x] 1.1 The model of decision 2: `Part`, `RingRef`, and `PolygonDrawing` with `parts` and an `open` ring. Adapt `addVertex`, `moveVertex`, `insertVertex`, `deleteVertex` and `canClose` to act on a ring of the drawing.
- [x] 1.2 `drawingProblem(parts)` (decision 3): self-crossing, contact between rings, a hole inside its part's exterior and outside its other holes, and parts outside each other except inside a hole. It returns the first problem's code, or null.
- [x] 1.3 Closing a ring: validate it, orient it (exterior counter-clockwise, hole clockwise, first vertex kept first; decision 4), and move a hole into the part that contains it.
- [x] 1.4 Delete a ring (a hole, or a part with its holes), refusing the last part.
- [x] 1.5 `drawingToGeometryFields`: `Polygon` with holes for one part, `MultiPolygon` for several, null while a ring is open. `drawingBounds` over all rings.
- [x] 1.6 `farmRowToDrawing` loads GeoJSON Polygons with holes and MultiPolygons, oriented and checked. Remove the `"shape"` reason.
- [x] 1.7 Unit tests:
  - each rule, with a touching hole, a crossing hole, a hole in a hole, overlapping parts, touching parts and an island inside a hole;
  - an exterior vertex moved over a hole;
  - orientation, keeping the first vertex;
  - the GeoJSON output for one and several parts;
  - loading a row and writing it back.

## 2. Map (`DrawingMap.tsx`)

- [x] 2.1 One editable `google.maps.Polygon` per part, with `paths: [exterior, ...holes]`, and listeners on every path of `getPaths()`. Report vertex clicks, right-clicks and path edits with their `RingRef`.
- [x] 2.2 The open ring as a `Polyline`. The closed parts are not clickable while a ring is open, so clicks inside a part add vertices.
- [x] 2.3 The selected vertex marker for any ring. A rejected edit is redrawn, as today.

## 3. Modal (`ManualFarmModal.tsx`)

- [x] 3.1 Toolbar (decision 6):
  - "Close polygon" while a ring is open;
  - "Add part", "Add hole", "Delete vertex", "Delete hole"/"Delete part" and "Start over" once a part exists.

  "Add point" adds to the open ring, and is disabled when none is open.
- [x] 3.2 Selection by `RingRef`, ring deletion, and the drawing errors of decision 10 shown as today's warning.
- [x] 3.3 The vertex table grouped by ring (decision 7), with the open ring last and rows selecting their vertex.
- [x] 3.4 Edit mode opens a farm with holes and parts on the bounds of all its rings.
- [x] 3.5 Locales (es, en):
  - the buttons, the ring names and the new error messages;
  - the instructions for a part or a hole being drawn;
  - the "How to draw?" steps and alt text in the animation's order (decision 9).

  Remove `notEditable.shape`.
- [x] 3.6 Modal tests, through the map stub:
  - a farm with two parts saved as a MultiPolygon;
  - a hole saved inside its Polygon;
  - a touching hole rejected with its message;
  - an island accepted;
  - deleting a hole and a part, and refusing the last part;
  - the grouped table;
  - "Add" disabled while a ring is open;
  - editing a farm with a hole and two parts.

## 4. The "How to draw?" animation

- [x] 4.1 `scripts/record-drawing-gif.mjs` (decision 9):
  - after the polygon and the dragged vertex, record "Add hole" with a ring inside the part, and "Add part" with a second plot beside it, each closed with "Close polygon";
  - pause on each finished state.

  Update its header comment.
- [x] 4.2 Record `public/images/manual-farm-drawing-{es,en}.gif` against the running app.
  - Check each one: the hole shows empty, the steps match, and each GIF is under 1 MB.
  - Update `HOW_TO_GIF` to the recorded size if the toolbar wrapped.

## 5. Check and deliver

- [x] 5.1 `tsc`, `pnpm lint` (no new warnings) and `pnpm test` in `apps/web`.
- [x] 5.2 Playwright in the app with Google Maps:
  - draw a farm with a hole and two parts, one of them an island inside the hole;
  - check that the hole shows empty;
  - drag a vertex over the hole and see it rejected;
  - add the farm, edit it from the list and validate it with the API (no `invalid_geometry`).
- [x] 5.3 CHANGELOG (the manual entry's line under Added), `docs/architecture.md` if it describes the drawing tool, and the PR #97 description.

  The PR description is updated once this is pushed, so it doesn't describe code the PR doesn't have yet.
- [x] 5.4 Archive the change in PR #97, and write the spec's purpose if the archive leaves it TBD.
