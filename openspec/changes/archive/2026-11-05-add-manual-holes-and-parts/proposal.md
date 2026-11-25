## Why

Monbo accepts farms with holes and of several parts from every file source (#86), but the manual entry draws one ring only. A producer with two separate plots, or a farm that must leave out a house, a river or a patch of forest, can't be drawn: they would have to make a geo file, or add each plot as a farm of its own, which splits the production across farms that aren't. The manual entry ships in the same PR as the other sources (#97), so it should take the same shapes from the start.

## What Changes

- **Holes and parts in the drawing tool.** Once the first polygon is closed, the toolbar offers "Add part" and "Add hole". The user draws the new ring as the first one: clicks, typed vertices with "Add point", then "Close polygon".
  - A hole goes to the part that contains it.
  - A part goes outside the others, or inside another part's hole (an island).
- **The same rules as the API, checked while drawing**, so a drawn farm is never rejected later:
  - no ring crosses itself;
  - a hole lies inside its part and doesn't touch its border;
  - holes don't touch each other;
  - parts don't overlap or touch.

  Every edit (a vertex added, moved, inserted or deleted) is checked against all the rings, not only its own. A rejected edit says which rule it broke.
- **A whole ring can be deleted:** "Delete hole" or "Delete part" on the selected ring. The farm keeps at least one part.
- **The vertex table groups the vertices by ring:** "Part 1", "Part 1 · Hole 1", "Part 2"…
- **The row's geometry:** a GeoJSON `Polygon` with its holes for one part, or a `MultiPolygon` for several.
- **Edit mode loads any GeoJSON polygon farm**, with its holes and parts. The "has holes or several parts, can't be drawn here" message goes away.
- **The help:** the instructions and the "How to draw?" steps mention holes and parts. The animation is recorded again, in es and en: after the polygon and the dragged vertex, it adds a hole and a second part.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `manual-farm-entry`:
  - the drawing gains holes and parts, with their rules and ring deletion;
  - the coordinates list groups the vertices by ring;
  - "How to draw?" covers holes and parts, in its steps and its animation;
  - edit mode loads farms with holes and parts.

## Impact

- **Web:**
  - `apps/web/src/utils/drawing.ts`: the drawing model and the rules between rings;
  - `apps/web/src/components/page/uploadData/DrawingMap.tsx`: one editable `google.maps.Polygon` per part, with its holes as paths and listeners on every path;
  - `ManualFarmModal.tsx`: the toolbar, the selection by ring and the grouped vertex table;
  - the `manualFarm` locales (es, en) and their tests;
  - `public/images/manual-farm-drawing-{es,en}.gif`, recorded again with `scripts/record-drawing-gif.mjs`.
- **API:** no change. `/farms/parse` already accepts Polygons with holes and MultiPolygons in GeoJSON, and orients their rings.
- **Dependencies:** none.
- **Delivery:** the change goes into PR #97, with the manual entry it extends, and is archived there.
