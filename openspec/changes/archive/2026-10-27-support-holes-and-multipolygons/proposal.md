## Why

Monbo rejects any farm whose polygon has a hole, and it can't read a farm made of several separate parts (a MultiPolygon). Both are common in the data users bring: a farm with a protected patch inside it, or one production place split by a road or a river. EUDR GeoJSON files, and the Shapefile and KMZ upload being prototyped, carry them as a matter of course. Today the user has to redraw these farms, or split one production place into several farms that don't match what they declare.

The analysis itself is ready: area, deforestation ratio and overlaps are computed with Shapely, which already handles holes and multiple parts. What blocks them is the contract. A farm travels between the web and the API as `PolygonDetails.path`, a single ring, and the API rebuilds the polygon from that ring on every request. That is why `fix-polygon-edge-cases` chose to reject holes until the path could carry them.

## What Changes

- **BREAKING (contract):** `PolygonDetails.path` is replaced by `parts`. Each part has an `exterior` ring and a list of `holes`; a simple polygon is one part with no holes. The API orients the rings (exterior counter-clockwise, holes clockwise), and `center` is a point guaranteed to lie inside the farm.
- **Parsing:** `/farms/parse` accepts polygons with holes and MultiPolygons, in WKT and in GeoJSON. `geometryType` is deduced from the coordinates. Both `"Polygon"` and `"MultiPolygon"` are accepted for any polygonal geometry, and `"Point"` keeps its meaning. `HOLES_NOT_SUPPORTED` is removed.
- **One farm, many parts:** a MultiPolygon is one farm, the way the EUDR treats it as one production place. Its area is the sum of its parts, and the deforestation ratio covers all of them. Holes are excluded from both.
- **Validation:** a farm whose parts overlap each other, or whose hole falls outside its exterior, is reported as `invalid_geometry`. A farm inside another's hole doesn't overlap it.
- **BREAKING (contract):** an overlap's `paths` (exteriors only) is replaced by `parts`, the same shape as a farm's, so the web can draw an overlap with its holes.
- **Maps (web):** every map draws each part of a farm with its holes. Clicking any part selects the farm. The modals' vertex tables say which part and ring each vertex belongs to.
- **Report images:** each farm gets **one** image that contains all its parts, even if the parts look small when they are far apart. Holes are outlined like the exterior.
- **Exports:**
  - The GeoJSON export writes a `Polygon` for a farm with one part and a `MultiPolygon` for a farm with several.
  - The Excel exports write a polygon's coordinates as a GeoJSON coordinates array, with holes and parts, so an exported file can be uploaded again. This builds on `fix-excel-export-columns`, which makes the Excel exports follow the upload template's columns.

## Capabilities

### New Capabilities
- `farm-geometry`: how a farm's geometry is represented between the API and the web (parts, exterior, holes, ring orientation, center), and how the web draws and exports it.

### Modified Capabilities
- `polygon-validation`: the "Polygon coordinates from WKT and GeoJSON" requirement now accepts holes and MultiPolygons and deduces the geometry type. New invalid-geometry cases cover parts that overlap and holes outside their part. Overlaps respect holes, and their shape is returned as `parts`.
- `deforestation-analysis`: the ratio is measured over every part of a farm, excluding its holes.
- `report-generation`: the whole-farm image requirement covers every part, and the farm drawn above the deforestation includes the outlines of its holes.

## Impact

- **API:**
  - `app/models/polygons.py` (`PolygonDetails`) and `app/models/farms.py` (`geometryType`);
  - `app/utils/farms.py` (parsing, `parse_base_information`, `get_farm_coords_and_radius`);
  - `app/utils/polygons.py` (`generate_polygon`);
  - `app/modules/polygons_validation/helpers.py` (`get_geometry_paths`), `models.py` (`OverlapData`) and `router.py`;
  - `app/modules/deforestation_analysis/router.py`;
  - `app/utils/image_generation/GeometryHelper.py`, which only accepts `Polygon` and `Point` today.
- **Contracts:** `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` are regenerated. The API and the web must be deployed together. No data is stored, so the only effect is that a tab open during the deploy has to be reloaded.
- **Web:**
  - `components/reusable/Map.tsx`;
  - `SelectedPolygonsMap.tsx`, `PolygonDetailModal.tsx`, `GeometryInconsistencyModal.tsx` and `OverlapInconsistencyModal.tsx`;
  - `utils/geojson.ts`, `utils/download.ts` and `utils/excel.ts` (geometry type and coordinates validation).
- **Tests:**
  - API: unit tests for parsing, area, deforestation, validation and image bounds with holes and multiple parts;
  - web: unit tests for the exports and the Excel validation;
  - `tests/regression` and `tests/numeric_baseline` adjusted to the new contract, with the numbers of existing farms unchanged.
- **Docs:** `docs/architecture.md`, where it describes the farm's geometry, and the upload template's instructions if they list the accepted geometry types.
- **CHANGELOG:** "Added" for holes and MultiPolygons, "Changed" for the Excel exports' coordinates column.

### Out of scope
- **Splitting a MultiPolygon into several farms.** It is rejected as a design: it breaks the farm's identity, its ID and its declared production.
- **One report image per part.** It was decided against: one image per farm, even when the parts look small.
- **Geometry collections, lines, and MultiPoints.** These stay unsupported.
- **A limit on parts or vertices per farm.** Left for a later change if payload size becomes a problem.
- **Translating Shapely's `explain_validity` reasons.** They keep showing as today.
