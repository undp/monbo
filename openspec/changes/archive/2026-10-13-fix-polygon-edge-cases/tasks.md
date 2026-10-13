## 1. Deforestation ratio (tests first)

- [x] 1.1 Add parametrized tests for `get_deforestation_ratio` in `tests/modules/deforestation_analysis/test_helpers.py`: area 0, area -1, ratio capped at 1, no loss, a normal ratio. Confirm the area -1 and area 0 cases fail on the current code.
- [x] 1.2 Add `/analize` tests in `tests/modules/deforestation_analysis/test_router.py` against a small synthetic raster (written to `tmp_path`): a bow-tie touching loss pixels, a bow-tie touching none, 1- and 2-vertex polygons, a farm outside the raster, and a request where one bad farm sits next to good ones. Confirm they fail on the current code.
- [x] 1.3 Make `get_deforestation_ratio` return `None` for an area ≤ 0.
- [x] 1.4 In `/analize`, return `None` for a farm whose polygon is invalid, empty or has no area, before masking the raster.
- [x] 1.5 Run 1.1–1.2 and see them pass.

## 2. Overlaps (tests first)

- [x] 2.1 Add `/validate` tests through `TestClient` in `tests/modules/test_polygons_validation.py`, with `OVERLAP_THRESHOLD_PERCENTAGE` patched to 1 and polygons built in metres around a fixed latitude. Cover:
  - contained, almost contained, identical;
  - equal-size half overlap;
  - exactly at the 1% threshold, exactly at the 80% HIGH cut;
  - three farms overlapping pairwise;
  - sharing only an edge or a vertex;
  - overlap plus a shared edge (`GeometryCollection`);
  - tiny farms that only touch.

  Confirm the contained, GeometryCollection and tiny cases fail on the current code.
- [x] 2.2 Add `polygonal_part(geometry)` to `polygons_validation/helpers.py`, with unit tests for `Polygon`, `MultiPolygon`, `GeometryCollection`, `LineString` and `Point` input.
- [x] 2.3 In `get_overlap_inconsistencies`, take area, centroid and paths from the polygonal part. Skip the pair when that part is empty or its area is 0, and drop the `abs(overlap - union) < 1e-10` special case.
- [x] 2.4 Compute `percentage` as `min(1, overlap_area / min(area1, area2))`, skipping the pair if the smaller area is 0. Keep the threshold and HIGH comparisons as they are.
- [x] 2.5 Run 2.1–2.2 and see them pass. Update `test_check_ploygons_overlap` only where it asserted the old behaviour, and say why in the test.

## 3. Geometry errors in `/validate` (tests first)

- [x] 3.1 Add `/validate` tests: polygons with 1 vertex, 2 vertices, collinear vertices, a self-intersection, and no vertices, each next to a valid farm. Confirm the 1-vertex case returns 500 on the current code.
- [x] 3.2 In `/validate`, catch a `ValueError` from `generate_polygon` per farm and report it as `invalid_geometry` with the reason "Too few points". Leave that farm out of the overlap check. Keep the 400 for a `type`/`details` mismatch.
- [x] 3.3 Run 3.1 and see it pass.

## 4. GeoJSON holes (tests first)

- [x] 4.1 Add tests for `parse_farm_coordinates_string`: a GeoJSON polygon with a hole gives the outer ring only, and the same polygon in WKT and GeoJSON gives the same path. A malformed inner ring is still rejected. Confirm the hole case fails on the current code.
- [x] 4.2 Make `_parse_geojson_polygon_coordinates` return the first ring only, after checking every ring's shape.
- [x] 4.3 Run 4.1 and see it pass.

## 5. Cleanup, regression and docs

- [x] 5.1 Delete `test_polygon_validation_valid_request` from `tests/test_app.py`; the tests in 2.1 and 3.1 cover `/validate`.
- [x] 5.2 `git lfs pull`, then run `uv run python -m tests.regression.generate`. Check the diff: F05/F06 change percentage, F07 becomes `NOT_VALID` in a HIGH overlap with F06, F10's deforestation becomes `None`, and nothing else moves.
- [x] 5.3 Update the comment above `sortedInconsistencies` in `apps/web/src/components/page/polygonsValidation/InconsistentFarmsTable.tsx` to say the percentage comes from the API as overlap area ÷ the smaller farm's area.
- [x] 5.4 Add CHANGELOG entries under Unreleased: "Changed" for the overlap percentage, "Fixed" for the negative ratio, the 500s and GeoJSON holes.
- [x] 5.5 Run the whole API suite (`uv run pytest` in `apps/api`), its linters (`ruff check`, `black --check`, `mypy app`), and `pnpm contracts` to confirm `openapi.json` and `schema.d.ts` don't change.
