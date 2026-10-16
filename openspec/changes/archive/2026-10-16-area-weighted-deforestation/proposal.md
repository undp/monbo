## Why

The deforestation ratio counts every loss pixel that **touches** a farm's polygon as if it lay entirely inside it (`rasterio.mask(all_touched=True)`, then count × `pixel_size`²). It divides by the polygon's area and caps the result at 1. Pixels that only graze the polygon's edge count in full, so small farms are over-reported. `docs/onboarding.md` already notes that it "tends to over-count at the edges".

A user saw it on an upload of 500 Ecuadorian farms. Farm F0041 (2.73 ha) reads **100% deforested** on GFW, but the map shows it only partly over loss. Measured against the area that actually lies on loss pixels:

| Farm | Area | Reported today | Area on loss |
|---|---|---|---|
| F0041 | 2.73 ha | 100% | 66.7% |
| F0330 | 3.06 ha | 100% | 73.0% |
| F0443 | 0.80 ha | 100% | 65.1% |
| F0329 | 2.19 ha | 82.1% | 57.4% |
| F0251 | 5.16 ha | 50.6% | 40.9% |

Across the 500 farms and the 4 Ecuadorian layers:
- **Over-estimate:** on farms with loss, the ratio is +5 to +11 points over the real share on average, depending on the layer, and up to +48.
- **False positives:** **3 to 6 farms per layer are flagged as deforested above the 2% threshold while their real share isn't**, because a loss pixel touches their edge. For due diligence (EUDR) this is the costly error.

## What Changes

- **BREAKING (results):** the ratio becomes **the share of the farm's area that lies on loss pixels**.
  - Each loss pixel counts by the part of it that is inside the polygon.
  - Both areas are measured in the raster's CRS.
  - The ratio is between 0 and 1 by construction, so the cap only guards against rounding.
  - The layer's `pixel_size` no longer enters the ratio. It stays in the index and the admin, which validate rasters with it.
  - Every farm's ratio changes, usually downwards, most for small farms. Farms with no loss pixel touching them stay at 0.
- **Unchanged:**
  - which farms get no ratio (`None`): invalid, empty or zero-area polygons, farms outside the raster, unbuildable geometries, unreadable rasters;
  - points are still analysed as the circle built from their area;
  - the request and response shapes of `/analize`.
- **Docs:** the formula in `apps/api/README.md`, `docs/architecture.md` and `docs/onboarding.md`. The report's appendix text ("the ratio between the deforested area… and the total area of the polygon") already describes the new method and stays as it is.
- **Tests:**
  - new unit tests on synthetic rasters;
  - the regression suite's expected results regenerated, with the diff reviewed;
  - the numeric baseline (a dependency-upgrade gate built on the same helpers) updated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deforestation-analysis`: the requirement "Deforestation ratio per farm and layer" changes its definition from touching pixels × pixel area to the area-weighted share, with new scenarios for partial, edge-only and sub-pixel coverage.

## Impact

- **API:**
  - `app/modules/deforestation_analysis/helpers.py`: a new `get_loss_area_fraction` replaces `get_deforestation_ratio` and `get_pixel_area` in the analysis;
  - `router.py` (`/analize`);
  - tests (`tests/modules/deforestation_analysis`, `tests/regression/expected_results.json`, `tests/numeric_baseline`).
- **Web:** none. It shows the ratio it receives. The thresholds, chips and report read the same field.
- **Behaviour:** analyses run after the deploy give different (lower or equal) percentages than before for the same farms. Reports generated earlier keep the old numbers.
- **Performance:** measured in a spike on 4985 (farm, layer) pairs, 1000 farms × 5 layers: **0.36 ms per pair, against 0.83 ms** for the current computation. The new value matches an equal-area exact reference.
