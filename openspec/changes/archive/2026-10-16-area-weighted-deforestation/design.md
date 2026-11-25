## Context

`/analize` (`app/modules/deforestation_analysis/router.py`) opens each layer's raster once, then for each farm:

1. builds the polygon (or the circle around a point) in EPSG:4326;
2. `get_map_pixels_inside_polygon`: a GeoDataFrame reprojects it to the raster's CRS, and `rasterio.mask(crop=True, all_touched=True)` returns the window of pixels touching it;
3. `get_deforestation_ratio`: count of pixels equal to 1 × `pixel_size`² (`get_pixel_area`, from the index), divided by the geodesic area of the polygon (`GeometryCalculator.calculate_polygon_area`), capped at 1. It returns `None` for an area of 0 or less (empty or invalid polygon).

The count is the problem, not the window. A pixel the polygon only grazes counts as a whole pixel, and the cap hides how far above 100% it goes: F0443 (0.80 ha) touches 13 loss pixels, or 145%.

The rasters come in two kinds of CRS:
- **Geographic:** GFW and TMF are EPSG:4326, with 0.00027° pixels.
- **Projected:** the MAATE layers are UTM (EPSG:32717, 30 m).

`pixel_size` is declared per layer in the index and checked against the raster by the admin on upload.

## Goals / Non-Goals

**Goals:**
- The ratio is the share of the farm's area on loss pixels, up to floating point, in both kinds of CRS.
- It costs no more than today: `/analize` of 1000 farms × 7 layers already takes 21.8 s on `dev`, against Azure's 240 s.
- No change to the `None` cases, to points as circles, or to the response shape.

**Non-Goals:**
- Changing the loss rasters, the layers' `pixel_size` or the admin's checks.
- Recomputing analyses already done. The web holds results only in memory, so the next upload gets the new ratio.
- Changing what the web shows. The thresholds, chips and report read the same `value`.

## Decisions

### D1. Weight each loss pixel by its intersection with the polygon

`get_loss_area_fraction(polygon, src)` replaces `get_deforestation_ratio` and `get_pixel_area` in the analysis:

1. Reproject the polygon to the raster's CRS (as today) and read the window with `mask(crop=True, all_touched=True)` (as today). `all_touched` stays: every pixel the polygon overlaps must be in the window, including those it only grazes.
2. Take the window's loss pixels (`== 1`). If there are none, the ratio is 0.
3. Build each loss pixel's square from the window's affine transform: `shapely.box`, vectorized over the pixels.
4. Compute the ratio as `shapely.area(shapely.intersection(squares, polygon)).sum() / polygon.area`, both in the raster's CRS, then `min(1.0, …)` as a guard against floating point.

- **Why the raster's CRS.**
  - **Projected rasters:** the areas are exact.
  - **EPSG:4326:** areas are in square degrees, but the ratio of two areas within a few hundred metres is the same as on the ground, because the scale factor is constant at that size.
  - **Checked:** against an equal-area (EPSG:6933) union of the loss pixels intersected with the polygon, the spike matched to 0.0000% on the checked pairs.
- **Why `pixel_size` leaves the ratio.** The pixels' real size comes from the raster's transform. `pixel_size`² is a fixed approximation that ignores latitude: in EPSG:4326 a pixel shrinks with cos(latitude), 1.5% at Costa Rica's 10°.
- **Alternative: count the pixels whose centre is inside (`all_touched=False`).** A one-line change, close to the real share for large farms (69.1% against 66.7% for F0041). But it is still discrete, and a polygon smaller than a pixel can get 0 while lying entirely on loss.
- **Alternative: supersampled rasterization**, such as `exactextract`. Exact, but it adds a dependency, and the vectorized intersection is already cheaper than today's computation.

### D2. What stays the same around it

- **No ratio (`None`):** the existing rules stay, with the geodesic area (`GeometryCalculator`) still deciding when there is none (area 0 or less: empty or invalid). An invalid polygon never reaches the intersection.
- **Outside the raster:** `mask` raising (`ValueError`, "Input shapes do not overlap raster") stays `None`, as today, through the router's `try`.
- **Points:** the same circle as today (`generate_polygon` with the radius from the declared area).
- **Old helpers:** `get_pixel_area` and `get_deforestation_ratio` are removed if nothing else uses them (the numeric baseline does, see D4).

### D3. Performance

**Measured in the spike** (`.context/area/spike.py`, local), on 4985 (farm, layer) pairs (`farms_1000.xlsx` × 5 Ecuador layers): **0.36 ms per pair for the new ratio, against 0.83 ms** for today's computation over the same window.
- The intersection only runs on the window's loss pixels, a few dozen for a typical farm.
- Both measurements include the GeoDataFrame reprojection. Replacing it with a cached `pyproj.Transformer` would be faster still, but it is out of scope.

**Check after implementing:** `/analize` of 1000 × 7 locally, against the baseline.

### D4. Tests and baselines

- **Unit tests** (`tests/modules/deforestation_analysis`): synthetic rasters in EPSG:4326 and in a UTM CRS, for the spec's scenarios (half a loss pixel, an edge sliver, sub-pixel on one loss pixel, sub-pixel across two, no loss), plus the `None` cases that already exist.
- **Regression suite** (`tests/regression`):
  - `expected_results.json` is regenerated with `tests/regression/generate.py`;
  - the per-farm diff (old and new ratio) is reviewed and recorded in the tasks;
  - every farm's ratio must be ≤ its previous ratio (by construction: each pixel now counts by a part of itself, at most all of it), and farms with 0 must stay at 0.
- **Numeric baseline** (`tests/numeric_baseline`): a dependency-upgrade gate built on `get_deforestation_ratio`. It moves to the new helper, and its reference is regenerated with `generate_baseline.py`. The commit message says it is a method change, not a library drift.

## Risks / Trade-offs

- **[Every result changes]** → Most farms go down a little, and farms near the threshold may change from deforested to deforestation-free. The CHANGELOG states it under Changed, with the example of F0041, so users comparing with old reports know why.
- **[Results differ from the "touching pixels" reading some users may expect]** → The new reading matches the map the app shows and the report's own text ("the ratio between the deforested area… and the total area of the polygon").
- **[Square-degree areas in EPSG:4326]** → The error is negligible at farm scale (D1, measured). A polygon spanning several degrees of latitude would see a small bias, which doesn't happen with farms.
- **[Slivers from floating point]** → `min(1.0, …)` and `max(0.0, …)`, plus the tests on exact pixel boundaries.

## Migration Plan

No data migration. It ships with the next API deploy, and new analyses use it from then on. Rollback is reverting the PR.

## Open Questions

None.
