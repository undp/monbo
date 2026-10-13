## Why

The API's tests barely cover the deforestation calculation and the polygon validation at their edges, and exploring those edges surfaced bugs that change what users see:

- **An invalid polygon can come out as deforestation-free.** `GeometryCalculator.calculate_polygon_area` returns `-1` for an invalid polygon, and `get_deforestation_ratio` only guards against an area of `0`. A self-intersecting ("bow-tie") polygon touching 3 loss pixels gets a ratio of **-2700**. The web compares `100 × -2700 > threshold`, which is false, and shows a green "< 1% Def." chip. Invalid polygons do reach the analysis from the web.
- **`POST /polygons_validation/validate` returns a 500** for real-looking input:
  - two farms that overlap in an area and also share an edge, because their intersection is a `GeometryCollection`;
  - two tiny polygons that only touch, because their areas round to 0, the pair is treated as a 100% overlap, and its `LineString` intersection can't be drawn;
  - a polygon with a single vertex, because `generate_polygon` raises and nothing catches it.
- **GeoJSON polygons with holes become invalid.** The parser appends the inner rings' points to the outer ring, so the polygon self-intersects, its area is `-1`, and the first bug follows. WKT drops the holes instead, so the two formats disagree.
- **A farm contained in another isn't flagged.** The overlap percentage is intersection ÷ union. A 1 ha farm entirely inside a 200 ha farm scores 0.5%, under the 1% threshold, and both stay VALID. Two producers declaring the same land is what this check exists to catch.

The regression suite didn't catch any of this. It pins whatever the code returns, including F10's `-0.0` and F07 (inside F06) as VALID.

## What Changes

- **Deforestation:** a farm whose polygon is invalid gets `None` for every layer, which the web already shows as "N/A". The ratio is never negative.
- **Validation never returns a 500 for a farm's geometry:**
  - an overlap uses only the polygonal part of the intersection;
  - intersections with no area (shared edges or vertices only) are not overlaps;
  - a polygon with fewer than 3 vertices is reported as `invalid_geometry`, like 2 vertices already are.
- **GeoJSON polygons keep only their outer ring**, like WKT. A farm with a hole is analysed and validated as its full outline.
- **The overlap percentage becomes intersection ÷ the smaller farm's area.** A contained farm scores 100%, so it is HIGH and both farms are NOT_VALID. The threshold (`OVERLAP_THRESHOLD_PERCENTAGE`, strictly greater) and the HIGH cut (above 80%) don't change. Their meaning does, so the percentages users see go up. This is a **BREAKING** change in reported numbers, not in the contract.
- **Parametrized tests for each edge case**, written first so they fail on the current code. The regression's expected results are regenerated, and the dead `test_polygon_validation_valid_request` is replaced.

## Capabilities

### New Capabilities
- `deforestation-analysis`: how `POST /deforestation_analysis/analize` computes a farm's deforestation ratio per layer, and when it returns `None`.
- `polygon-validation`: how `POST /polygons_validation/validate` detects overlaps and geometry problems, how the overlap percentage and criticality are computed, and that a farm's geometry never makes it fail. It also covers how polygon coordinates are parsed from WKT and GeoJSON.

### Modified Capabilities
<!-- None: no existing spec covers the analysis or the validation. `product-configuration` owns the threshold settings, which keep their names, ranges and defaults. -->

## Impact

- **API:**
  - `app/modules/deforestation_analysis/helpers.py` and `router.py`;
  - `app/modules/polygons_validation/helpers.py` and `router.py`;
  - `app/utils/farms.py` (GeoJSON parsing).
- **Web:** only the stale comment that documents the overlap formula in `InconsistentFarmsTable.tsx`. The response shapes don't change, so `openapi.json` and `schema.d.ts` stay as they are.
- **Tests:**
  - new unit tests under `tests/modules/deforestation_analysis/` and `tests/modules/`;
  - `tests/regression/expected_results.json` is regenerated: F05/F06 change percentage, F07 becomes NOT_VALID, F10's deforestation becomes `None`.
- **Users:** overlap percentages rise. More narrow slivers between neighbouring farms may cross the 1% threshold; users can mark those as valid by hand, as today.
- **CHANGELOG:** "Changed" for the overlap formula, "Fixed" for the bugs.

### Out of scope
- **"No data" vs "no loss":** a farm inside a raster's extent but outside its coverage gets 0.0, not `None`. This was judged acceptable.
- **Point buffers** are drawn in latitude degrees, so they shrink east–west away from the equator.
- **Holes as real holes:** supporting them would change `PolygonDetails.path` and everything that draws farms.
- **Coordinate range and NaN checks**, and duplicate IDs in `/validate`.
