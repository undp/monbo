## Context

The manual entry (`add-farm-upload-sources`, PR #97) draws one ring on Google Maps with our own tool. Google's Drawing Library is gone.
- **The rules:** `utils/drawing.ts` holds the drawing rules. The model is `{ type: "polygon", vertices, closed }`, and every edit is accepted only if that ring stays simple.
- **The map:** `DrawingMap.tsx` draws the ring as an editable `google.maps.Polygon` (or a `Polyline` while open), and reports clicks and path edits. The modal applies them through `drawing.ts`.
- **Edit mode:** `farmRowToDrawing` refuses a row with holes or several parts (`reason: "shape"`).

The API (#86) already takes a GeoJSON Polygon with holes and a MultiPolygon.
- `/farms/parse` orients their rings.
- Validation reports `invalid_geometry` for a self-intersection, a hole outside its part, and parts that overlap.
- A part inside another part's hole is valid, and the map image fills it (`55d79d1`).

## Goals / Non-Goals

**Goals:**
- Draw a farm of several parts, each with holes, with the same interaction as the single ring.
- Reject, while drawing, every shape the API would report as `invalid_geometry`, with a message that says which rule broke.
- Load any GeoJSON polygon farm in edit mode.

**Non-Goals:**
- **Parts that share an edge or touch at a vertex.** Forbidding all contact is simpler to explain and to check (decision 3).
- **Editing a WKT row**, a MultiPoint, or a farm from a file: the modal still edits manual farms only.
- **Splitting or merging parts**, or moving a hole to another part.
- **Showing the area while drawing.**

## Decisions

### 1. Explicit "Add part" and "Add hole" buttons

The user says what the next ring is. The tool doesn't deduce it from where the ring lies.
- **The hole's part:** the hole is assigned, when it closes, to the part that contains it. The user doesn't pick a part.
- **Islands:** a part drawn inside another part's hole is valid.

*Alternative: one "Draw another polygon" button that makes a hole of a ring inside a part, and a part of one outside.* It means one button less, but a hole that strays over the border would turn into an overlapping part. The error would then talk about parts the user never meant to draw. With the user's intent known, the message can say "the hole must lie inside the farm".

### 2. The model: parts, and the ring being drawn

```ts
type Ring = Coordinates[];                       // open: no repeated first vertex
type Part = { exterior: Ring; holes: Ring[] };
type PolygonDrawing = {
  type: "polygon";
  parts: Part[];                                 // closed rings only
  open: { kind: "part" | "hole"; vertices: Ring } | null;
};
type RingRef = { part: number; hole: number | null };   // hole null: the exterior
```

- **Starting:** the first ring starts as `open: { kind: "part" }`.
- **Closing:** "Close polygon" validates the open ring and moves it into `parts` (or into its part's `holes`).
- **The geometry:** `drawingToGeometryFields` needs `open === null` and at least one part.
  - one part: `Polygon [[exterior], [hole]…]`;
  - several: `MultiPolygon [[[exterior], [hole]…], …]`.
- **Selection:** the selected vertex becomes `{ ring: RingRef, index }`.

*Alternative: a flat list of rings, each with a role.* Containment would then be implicit, and the output would have to regroup the holes under their parts on every change. Keeping parts makes the GeoJSON nesting, the table grouping and "Delete part" (with its holes) direct.

### 3. One check for the whole drawing, with no contact between rings

`drawingProblem(parts)` returns the first broken rule, or null. Every edit builds the candidate drawing and runs it, so a vertex moved on an exterior is checked against its holes and the other parts too. The rules:

1. **Each ring is simple:** `pathCrosses`, as today.
2. **No two rings share a point:** no edge of one intersects an edge of another (`segmentsIntersect`, which already counts touching).
3. **Containment:** with no contact, one vertex per ring decides it (ray casting).
   - each hole lies inside its part's exterior;
   - a hole doesn't lie inside another hole of its part;
   - a part's exterior lies outside every other part, except inside one of that part's holes (an island).

These are the API's rules, made stricter: OGC lets a hole touch its border at one point, and lets parts touch at points. Forbidding all contact makes rule 3 a one-point test, and the message is simply «no puede tocar el borde».

**Cost:** O(R²·n²) for R rings of n vertices. That's a few thousand segment tests for a farm drawn by hand, on each edit, which is negligible.

*Alternative: incremental checks per edit kind.* That is faster in theory, but it's one code path per edit, and edit mode would need the full check anyway. One function serves both.

### 4. Ring orientation in the model, for Google's holes

Google Maps shows an inner path as a hole only if it winds opposite to the outer one. When a ring closes, it is oriented in the model: exterior counter-clockwise, hole clockwise, by the sign of its area. The reversal keeps the first vertex first: `[v0, vn, …, v1]`.

The map's path indexes then equal the model's, and no index mapping is needed between `PolyMouseEvent.vertex` or `insert_at` and the model. The vertex table renumbers vertices 2…n of a reversed ring when it closes. That is acceptable: the numbers follow the ring, and the first vertex keeps its place.

*Alternative: keep the drawing order and reverse only for display.* That needs an index mapping on every event, which is easy to get wrong for `insert_at`.

### 5. The map: one editable Polygon per part

- **Each closed part** is a `google.maps.Polygon` with `paths: [exterior, ...holes]`. `PolyMouseEvent.path` gives the ring, and `set_at`/`insert_at` listeners go on every path of `getPaths()`.
- **The open ring** is a `Polyline`, as today.
- **While a ring is open,** the closed parts are not clickable. Clicks inside a part reach the map, which is how a hole gets drawn, and they can't drag the finished rings meanwhile.

### 6. Toolbar, selection and deletion

- **The toolbar:**
  - while a ring is open: "Close polygon";
  - once the farm has a part: "Add part", "Add hole", "Delete vertex", "Delete hole" or "Delete part", and "Start over".
- **"Add hole":** enabled once a part exists.
- **Deleting a ring:** "Delete hole/part" acts on the selected vertex's ring. Deleting a part deletes its holes. The last part can't be deleted: "Start over" clears the farm.
- **Too few vertices:** deleting a vertex of a 3-vertex ring still says "needs at least 3 vertices", and the ring is deleted with its own button.
- **"Add point":** adds to the open ring. It is disabled when no ring is open.

### 7. The vertex table groups by ring

- **Heading:** "Vértices de la finca (n)", with n counting every ring.
- **Groups:** one header row per ring ("Parte 1", "Parte 1 · Hueco 1", "Parte 2"), numbered within each ring.
- **The open ring** is listed last, under the name it will have.
- **Selection:** a row selects its vertex, as today.

### 8. Edit mode

`farmRowToDrawing` parses a GeoJSON Polygon (rings) or MultiPolygon (polygons of rings). It drops each ring's repeated last position, orients the rings as in decision 4, and runs `drawingProblem`.
- **Reasons for refusal:** the `"shape"` reason goes. `"format"` stays for WKT, and `"invalid"` for coordinates that don't parse or break a rule.
- **The map opens** on the bounds of all the rings.

### 9. One longer animation

The "How to draw?" GIF is recorded again by `scripts/record-drawing-gif.mjs`, against the real modal as today, in es and en. It shows the whole story in one loop:
1. vertices clicked, "Close polygon", a vertex dragged (as today);
2. "Add hole", a ring clicked inside the part, "Close polygon": the hole shows empty;
3. "Add part", a second plot clicked beside the first, "Close polygon".

- **Steps under the animation:** they follow the same order.
- **The alt text:** describes the three moments.
- **Size:** the script keeps one palette and only stores what changes between frames. The target is under 1 MB per language (today's are about 380 KB). If it goes over, the pauses get shorter before any frame is dropped.
- **Its dimensions:** the toolbar gains buttons and may wrap to a second row at the map's width. That changes the recorded height, so `HOW_TO_GIF` in the modal is updated to the new size.

*Alternative: a second, short GIF for parts and holes, next to today's.* Each would be shorter, but the dialog would hold two animations and two step lists. One loop shows how the three actions follow each other, which is what a first-time user needs.

### 10. Messages

The existing ones stay: `crossing`, `minVertices`, `cannotClose`. The new ones (es):

| Code | Message |
|---|---|
| `ringsTouch` | Los bordes de las partes y los huecos no pueden tocarse ni cruzarse. |
| `holeOutside` | El hueco debe quedar dentro de una parte de la finca, sin tocar su borde. |
| `holeInHole` | Un hueco no puede quedar dentro de otro hueco. Para un lote dentro de un hueco, usa «Agregar parte». |
| `partOverlaps` | Una parte no puede quedar encima de otra. Sí puede quedar dentro de un hueco. |
| `lastPart` | La finca necesita al menos una parte. Para empezar de nuevo, usa «Empezar de nuevo». |

## Risks / Trade-offs

- **[Google's hole rendering depends on winding]** → Rings are oriented in the model on close and on load (decision 4). Playwright checks that a hole shows empty on the satellite map.
- **[An exterior edit can push a hole out, or into another part]** → Every edit runs the whole-drawing check (decision 3), and the rejected edit is undone on the map, as today (`revision`).
- **[Users don't know when they need a part rather than a hole, or an island]** → The buttons say what each one is for, and the messages point to the other one. The "How to draw?" steps add one line on parts and holes.
- **[Forbidding contact rejects valid OGC shapes]** (a hole touching its border at a vertex, plots that share a corner) → It is rare in hand-drawn farms, and the message says what to do. It can be relaxed later in `drawingProblem` alone.
- **[jsdom can't see the map]** → `drawing.ts` holds every rule and is unit-tested. The modal tests play the map's events through the stub, as today. Playwright draws a farm with a hole and two parts in the real app.
- **[A longer GIF is harder to follow and heavier]** → The three moments are separated by short pauses on the finished state, the steps below repeat them in writing, and the size target is 1 MB.
- **[The PR grows]** → This change is archived in PR #97 like `add-farm-upload-sources`, and its tasks are self-contained so they can be reviewed apart.
