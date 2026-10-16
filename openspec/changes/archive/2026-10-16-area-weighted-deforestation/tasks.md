## 1. Baseline

- [x] 1.1 Before changing the method, record:
  - the current ratios for `.context/scale/farms_500.xlsx` × the 4 official Ecuador layers (per farm and layer, to compare in 4.2);
  - the `/analize` time locally for `farms_1000.xlsx` × the local Ecuador layers;
  - the regression suite passing on `origin/dev`.

  Recorded with `.context/area/baseline.py` (in-process `/analize`, `.local-maps`, the 5 Ecuador layers: GFW, TMF, the two MAATE layers and a layer created in the admin). 500 × 5: 2.3 s. 1000 × 5: 4.5 s and 4.4 s. The API suite passed (355 tests).

## 2. Area-weighted ratio

- [x] 2.1 `get_loss_area_fraction(polygon, src)` in `app/modules/deforestation_analysis/helpers.py` (D1): reproject, read the window with `all_touched=True`, take the loss pixels' squares from the window's transform (`shapely.box`, vectorized), sum their intersection areas with the polygon, divide by the polygon's area in the raster's CRS, and clamp to [0, 1]. 0 when there is no loss pixel

  The squares come from the four corners of each pixel through the window's affine transform (`shapely.polygons`), not `shapely.box`, so a raster that isn't north-up is measured right too.
- [x] 2.2 `/analize` uses it (`router.py`). The `None` rules are unchanged (D2): geodesic area of 0 or less, outside the raster, unbuildable geometry, unreadable raster. Remove `get_pixel_area` and `get_deforestation_ratio` if nothing else uses them after 3.3

  Removed, with `get_map_pixels_inside_polygon`: after 3.3 nothing else used them. `pixel_size` stays in the index: the web compares it to detect a changed layer, and the admin checks it against the raster (the comment in `processing.py` and `docs/maps.md` no longer say the analysis uses it).
- [x] 2.3 Unit tests on synthetic rasters, in EPSG:4326 and in UTM:
  - half a loss pixel;
  - an edge sliver below the threshold;
  - sub-pixel fully on a loss pixel (1);
  - sub-pixel across loss and no loss (0.5);
  - no loss (0);
  - 2 of 4 pixels (0.5);
  - plus the existing `None` cases.

  Run pytest, ruff, black and mypy

  `test_get_loss_area_fraction`: 8 cases on 4 × 4 layers, each in EPSG:4326 (0.00027°) and in UTM 17S (30 m), plus outside the raster (`ValueError`, which the router turns into `None`). A router test on a real raster: a square half on loss gives 0.5. `test_analize` mocks the new helper. 365 tests pass; ruff, black and mypy are clean.
  - **Found on the way, not changed:** `GeometryCalculator.calculate_polygon_area` fails (and the farm gets `None`) when a polygon's latitudes are exactly symmetric about the equator, because the Albers projection gets `lat_1 = -lat_2`. The router test moved its square off the equator; a real farm hits it only if its bounds are exactly symmetric.

## 3. Baselines

- [x] 3.1 Regenerate `tests/regression/expected_results.json` (`tests/regression/generate.py`). Record the per-farm diff here, and check that no ratio went up and that the 0s stayed at 0

  Regenerated with `MAPS_ROOT=` (the flat `app/maps`; the local `.env` points to `.local-maps`). The sparse fixtures came out byte-identical; `expected_results.json` and the Excel's "Resultados esperados" sheet change. The farms' areas and the validation don't change. No ratio went up, and no 0 or `None` changed:

  | Farm | Layer | Before | After |
  |---|---|---|---|
  | F01 | 0 | 80.51% | 59.15% |
  | F01 | 1 | 52.33% | 37.27% |
  | F01 | 4 | 60.38% | 46.19% |
  | F02 | 0 | 32.27% | 23.84% |
  | F02 | 1 | 14.20% | 9.62% |
  | F04 | 0 | 93.03% | 69.72% |
  | F04 | 1 | 100.00% | 76.78% |
  | F05 | 5 | 18.40% | 14.30% |
  | F06 | 5 | 8.18% | 8.18% |
  | F08 | 0 | 10.50% | 8.68% |
  | F08 | 1 | 7.17% | 6.19% |
  | F08 | 2 | 2.83% | 2.82% |
  | F08 | 3 | 9.00% | 8.36% |
  | F08 | 4 | 0.33% | 0.22% |

  F01 drops the most for a whole farm: it is 6.71 ha (about 75 pixels) with 60 loss pixels touching it, so its edge pixels are a large share. F01 (layers 0 and 1), F04 (1) and F08 (4) were checked against an equal-area reference (the union of the loss pixels ∩ the farm, in EPSG:6933): equal to 4 decimals.
- [x] 3.2 Check `tests/regression/parity.py` still works (it compares two deployments, so no expected values change)

  It doesn't import the removed helpers, and `test_parity.py` passes.
- [x] 3.3 Numeric baseline (`tests/numeric_baseline`): switch it to the new helper and regenerate its reference with `generate_baseline.py`. Note in the commit that this is a method change

  `_common.py` computes `scalar_ratio` with `get_loss_area_fraction`. `scalar_ratio_pure` (the pure count) and `map_data` are gone. The gate requires the reference to come from numpy 1, and the project now requires Python ≥ 3.13, where numpy 1.26 has no wheels. So the new value was computed in a standalone Python 3.11 environment with numpy 1.26.4, rasterio 1.4.3 and the other versions of the recorded provenance, and only `scalars` was updated in `baseline.json`: the raster and the tile don't change, so their provenance stays valid. The value, 0.6510416666664296, is the same under numpy 2, and it matches the analytic 960 × 0.000625² / 0.024² = 0.6510416… (the polygon holds the whole loss block minus its nodata hole).

## 4. Verification

- [x] 4.1 F0041: GFW ≈ 0.667 (the spec scenario), with the web showing about 66.7%. Check it in the browser on the analysis map, next to the user's screenshot

  The local app, after uploading `farms_500.xlsx` with the 4 official layers, shows F0041 at **66.7% DEF.** in GFW (it showed 100%), 31.4% TMF, 95.7% MAATE 2020-2022 and 63.4% MAATE 2020-2023 (`.context/scale/f0041-table.png`).
- [x] 4.2 Before/after table for the 500 farms × 4 layers: farms flagged above the 2% threshold, false positives removed, the mean and maximum change. Record it here

  | Layer | Above 2% before | After | No longer flagged | Newly flagged | Farms with loss | Mean change | Largest drop |
  |---|---|---|---|---|---|---|---|
  | GFW | 48 | 44 | 4 | 0 | 49 | −7.7 pts | −34.9 pts |
  | TMF | 30 | 25 | 5 | 0 | 33 | −5.1 pts | −47.9 pts |
  | MAATE 2020-2022 | 28 | 22 | 6 | 0 | 28 | −6.3 pts | −20.9 pts |
  | MAATE 2020-2023 | 28 | 25 | 3 | 0 | 28 | −10.6 pts | −43.5 pts |

  No ratio went up, no 0 became positive, and no `None` changed. The admin-created layer has no loss on these farms (0 before and after). GFW for the farms of the proposal: F0041 100% → 66.7%, F0330 100% → 73.0%, F0443 100% → 65.1%, F0329 82.1% → 57.4%, F0251 50.6% → 40.9%.
- [x] 4.3 `/analize` time for 1000 farms × the local layers, before and after (the target is not slower)

  1000 × 5 in-process: 4.5 s and 4.4 s before, 2.7 s and 2.2 s after.

## 5. Close

- [x] 5.1 Docs: the formula in `apps/api/README.md` (Deforestation analysis), `docs/architecture.md` (§2, step 3) and `docs/onboarding.md` (the formula and the all_touched note)
- [x] 5.2 CHANGELOG, under Changed: the method and why, with the example of F0041 (100% → 66.7%), stating that new analyses give equal or lower percentages than before
