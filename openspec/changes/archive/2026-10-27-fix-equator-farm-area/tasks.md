## 1. Failing tests first

- [x] 1.1 `tests/helpers/test_geometry_calculator.py` (new):
  - a 30 ha and a 300 ha square symmetric about the equator get their area, with no error;
  - a 10 ha exterior with a 1 ha hole, plus a 5 ha part, gives 14 ha;
  - the same with clockwise rings gives the same positive area;
  - an invalid polygon gives −1, an empty one 0;
  - a few ordinary farms (Costa Rica, Ecuador, a high latitude) keep the area the current method gives, to the square centimetre (values recorded from `dev`).
- [x] 1.2 Endpoint tests for a 300 ha farm from −0.008° to +0.008°:
  - `/farms/parse` answers 200 with its area;
  - `/polygons_validation/validate` answers 200 for two farms whose overlap is symmetric about the equator, and reports the overlap;
  - `/deforestation_analysis/analize` gives it a ratio. The test from `support-holes-and-multipolygons` that avoided a symmetric square goes back to one.

## 2. Fix

- [x] 2.1 `GeometryCalculator.calculate_polygon_area`: orient each part, then `abs(Geod(ellps="WGS84").geometry_area_perimeter(...)[0])`, rounded to 2 decimals. Invalid gives −1 and empty gives 0, as today.
- [x] 2.2 Remove `_calculate_area_with_local_projection`, `_calculate_area_with_global_projection`, `_check_area_accuracy` and their constants (and `_lon_span` if unused), after a grep confirms nothing else uses them.

  `GeoHelper.deg_for_square_side` is removed too: only the area thresholds used it.

## 3. Verify

- [x] 3.1 API `pytest`, `ruff`, `black --check` and `mypy app` pass. The regression and numeric baseline suites pass without being regenerated.

  Ruff, black and mypy pass, and so do all 445 tests. The numeric baseline passes unchanged.

  The regression suite moved on two farms' areas, by 1 to 2 cm² of about 7 ha: F02 went from 69,731.35 to 69,731.37 m², and F06 from 70,920.31 to 70,920.32 m². Their ratios and overlaps didn't change. Once approved, it was regenerated: `expected_results.json` changes by those two lines, and the results sheet of `regression_farms.xlsx` by the same two values. The fixtures don't change.
- [x] 3.2 One-off comparison (in `.context/`, not committed) of the old and new areas over about 1,000 random polygons: 0.1 to 1,000 ha, latitudes −60° to 60°, with and without holes. Record the largest difference and the timing of both.

  Over 1,000 irregular polygons (296 with a hole), using `.context/compare_areas.py` against `dev`'s implementation:
  - 828 are identical to the cm²;
  - the largest difference is 0.91 m² (0.0007%), on 13.5 ha at 27.7°S;
  - the area takes 47 µs per polygon, against 200 µs before.

  A 20 × 20 km square (48,500 ha) differs by 480 m² (0.0001%). The edges are straight lines in the projection before and geodesics now, which is negligible at farm scale.

## 4. Docs

- [x] 4.1 `docs/deforestation_calculation.md`: the farm's area is the geodesic area on WGS84.
- [x] 4.2 CHANGELOG "Fixed": large farms symmetric about the equator.
