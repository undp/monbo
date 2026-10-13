## Context

The analysis and the validation build their geometry in the same place: `get_farm_coords_and_radius` produces the coordinates and `generate_polygon` builds a Shapely polygon from them. Both then measure it with `GeometryCalculator.calculate_polygon_area`. That function returns `-1` for an invalid polygon, `0` for an empty one, and otherwise the area in m², rounded to 2 decimals. Its callers treat that sentinel differently:

- **`/analize`** (`deforestation_analysis/router.py`) wraps each farm in a `try` that turns any exception into `None`. But an invalid polygon raises nothing: `-1` flows into `get_deforestation_ratio`, which only guards `== 0`.
- **`/validate`** (`polygons_validation/router.py`) calls `generate_polygon` outside any `try`. `detect_overlaps` skips invalid polygons but keeps any pair that `intersects`, including pairs that only touch. `get_overlap_inconsistencies` divides by the union, and `get_geometry_paths` raises on anything that isn't a `Polygon` or `MultiPolygon`.

`PolygonDetails.path` is a single list of coordinates, so the contract can't carry holes. The response models (`OverlapData`, `InvalidGeometryInconsistency`, `EmptyPolygonInconsistency`) already fit every outcome this change needs, so neither `openapi.json` nor the web's generated types change.

The regression suite (`tests/regression/`) pins whatever the code returns. `generate.py` regenerates it from the real rasters, which needs `git lfs pull`. CI checks it against committed sparse fixtures.

## Goals / Non-Goals

**Goals:**
- No negative or meaningless deforestation ratios: an unmeasurable farm gets `None`.
- No 500 from `/validate` caused by a farm's geometry.
- A farm inside another, or nearly inside, is flagged.
- One parametrized test per edge case in the specs, each written to fail on the current code.

**Non-Goals:**
- Telling "no data" from "no loss" in rasters.
- Drawing point buffers in metres instead of latitude degrees.
- Carrying holes through the contract.
- Validating coordinate ranges, NaN, or duplicate IDs.
- Changing `OVERLAP_THRESHOLD_PERCENTAGE`, its default, or the HIGH cut.

## Decisions

### 1. An invalid polygon's ratio is `None`, checked before measuring

`/analize` measures the polygon first and only masks the raster when its area is greater than 0. `calculate_polygon_area` already returns `-1` for an invalid polygon and `0` for an empty one, so that single check covers both. Otherwise the farm's value for that layer is `None`. `get_deforestation_ratio` also returns `None` for an area ≤ 0, so the function is safe on its own and its unit tests document that. The router's result type already allows `None`.

- *Alternative: repair the polygon with `make_valid` and analyse it.* Rejected. A bow-tie becomes two triangles, which may not be the land the producer declared, and the validation step already tells the user the geometry is wrong. "N/A" is honest.
- *Alternative: return 0.* Rejected. The web would show "deforestation-free", which is the bug.

### 2. Overlaps use the polygonal part of the intersection

A helper `polygonal_part(geometry)` returns the intersection's polygons:
- a `Polygon` or `MultiPolygon` is returned as is;
- for a `GeometryCollection`, its `Polygon`/`MultiPolygon` members are collected into one geometry;
- anything else (`LineString`, `Point`, `MultiLineString`) is an empty polygon.

`get_overlap_inconsistencies` takes the area, centroid and paths from that part. It skips the pair when the part is empty or its area is 0 m². That replaces the `abs(overlap - union) < 1e-10` special case, which is what turned two touching 0 m² polygons into a 100% overlap.

`detect_overlaps` keeps using `intersects`: Shapely's `overlaps` misses containment, and the area check filters out touching pairs. `get_geometry_paths` keeps raising for unsupported types, because it now only ever gets polygonal input.

- *Alternative: `intersection(...).buffer(0)`.* Rejected. It doesn't reliably drop line parts and it can move vertices.

### 3. Overlap percentage = intersection ÷ smaller farm's area

`percentage = min(1, overlap_area / min(area1, area2))`. The threshold comparison (`100 × percentage > OVERLAP_THRESHOLD_PERCENTAGE`) and the HIGH cut (`> 0.8`) stay as they are; only their input changes. If the smaller area is 0, the pair is skipped. That can't happen for two valid polygons whose intersection has area, but the guard keeps the division safe.

- *Alternative: keep intersection ÷ union and add "if one is within the other, flag HIGH".* Rejected. The table would show "0.5% — HIGH", and a farm that sticks out by one metre wouldn't count as contained.
- *Alternative: one percentage per farm in the response.* Rejected for now. It is the most informative option, but it changes the contract, the table and the Excel download. The smaller-farm ratio gives the same flagging with no contract change.

### 4. Polygons with fewer than 3 vertices are invalid geometry

The fix goes in `/validate`, not in `generate_polygon`:
- `/validate` wraps `generate_polygon` per farm. A `ValueError` (today, a polygon farm with one vertex) is recorded for that farm and reported as `invalid_geometry` with the reason "Too few points". The farm is left out of the overlap check, like any invalid polygon.
- Two vertices already produce an invalid polygon ("Too few points in geometry component"), and collinear vertices already produce one ("Self-intersection").

A `type`/`details` mismatch from `get_farm_coords_and_radius` stays a 400, because the request itself is malformed.

`generate_polygon` keeps raising on a point without a radius: that is a programming error for its other callers.

### 5. GeoJSON keeps the outer ring only

`_parse_geojson_polygon_coordinates` reads `rings[0]` and ignores the others, like WKT's `geom.exterior`. The inner rings are still checked for shape (each one a list of `[lng, lat]` pairs), so a malformed file is still rejected.

- *Alternative: carry holes through the contract.* Rejected for this change. `PolygonDetails.path` would become a list of rings, and the map, the report, the downloads and the image generation would all have to draw them.

  Ignoring holes means a farm is analysed over its full outline. For deforestation, the risk runs in the cautious direction: loss inside an excluded patch counts against the farm, rather than going unseen.

### 6. Tests first, parametrized, next to the code they cover

- **`tests/modules/deforestation_analysis/test_helpers.py`:** `get_deforestation_ratio` across area 0, area -1, the cap, and no loss.
- **`tests/modules/deforestation_analysis/test_router.py`:** `/analize` for a bow-tie touching loss, against a small synthetic in-memory raster; for 1- and 2-vertex polygons; and to check that one bad farm leaves the rest intact.
- **`tests/modules/test_polygons_validation.py`:** `/validate` through `TestClient` for every scenario in the `polygon-validation` spec, with `OVERLAP_THRESHOLD_PERCENTAGE` patched to 1. The polygons are built in metres around a fixed latitude, so the expected percentages are exact.
- **GeoJSON vs WKT parity:** tested on `parse_farm_coordinates_string`.

Each new test must fail on the current code before its fix lands. `test_polygon_validation_valid_request` in `tests/test_app.py` returns before testing anything; the `/validate` tests replace it, and it is deleted.

## Risks / Trade-offs

- **More overlaps flagged between neighbours.** A 2 m sliver along a 100 m boundary between two 1 ha farms goes from about 1% to about 2%. → Accepted. Users can mark a farm as valid by hand, and the threshold is an environment setting if it needs raising later.
- **Users see higher percentages for the same data.** → CHANGELOG entry under "Changed", and the PR shows the regression diff (F05/F06).
- **Regenerating the regression needs the real rasters.** → Run `git lfs pull` and then `tests.regression.generate`, and review the diff of `expected_results.json` and of the "Resultados esperados" sheet in the PR. CI only replays the committed fixtures.
- **`None` where users used to see "Libre Def."** for an invalid farm. → Intended. The validation step already marks that farm NOT_VALID.

## Migration Plan

No data migration and no contract change. It deploys with the API like any other change. Rolling back restores the old numbers. Users with an analysis open simply see the new results on their next validation or analysis.

## Open Questions

- Should the web explain an "N/A" caused by an invalid geometry differently from one caused by a farm outside the layer? Today both show "N/A". That would be a follow-up in the web.
