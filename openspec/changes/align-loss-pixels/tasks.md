## 1. Baseline

- [x] 1.1 Before changing the code, record per-tile times at z6, z8, z10 and z15 for a COG with overviews (an admin upload) and for a raster without them (GFW in `.local-maps`), and the shift of tiles and report images against an exact render around `F-VALIDACION`

  Recorded locally (`.context/area/tile_offset.py`, `image_offset.py`), ms per tile:

  | Raster | z6 | z8 | z10 | z15 |
  |---|---|---|---|---|
  | `layer-4-v1.tif` (admin upload, COG, overviews to 1/256) | 16 | 18 | 10 | 6 |
  | `gfw.tif` (copied by `migrate_countries`: one strip per row, no overviews) | 2,663 | 200 | 25 | 5 |

  Shift around `F-VALIDACION`:
  - **Tiles:** 14 m (z16), 13 m (z18), 13 m (z19); 5.2%, 10.8% and 28.5% of the tile pixels differ from the exact render.
  - **Report images:** 12–14 m at zoom 16, 17 and 18; 3.6%, 6.8% and 4.5% of the pixels differ.

## 2. Tests that check where the pixels are drawn (written first: they fail on today's code)

- [x] 2.1 A test helper that renders a raster exactly onto a Web Mercator grid: the source pixel under each output pixel's centre, computed with `pyproj` and the raster's inverse transform

  `exact_render` in `tests/utils/test_loss_drawing.py`. It also marks the output pixels within 0.001 of a source pixel's edge (`EDGE_TOLERANCE`): GDAL approximates the transform, and in UTM it put up to 15 of 262,144 test pixels on the other side, all within 0.0004 of a pixel (1 cm at 30 m). Exact (`tolerance=0`) cost 5× per tile in UTM.
- [x] 2.2 Tile tests on synthetic rasters with a random loss pattern, in EPSG:4326 and in UTM 17S, at several zooms: every tile pixel equals the exact render. Outside the raster: an empty tile

  3 layers: EPSG:4326 in Ecuador, EPSG:4326 in Costa Rica (where the old VRT's grid drifts from the source's) and UTM 17S; zooms 13, 15, 17 and 19. On `dev`'s code, 14 of the 26 drawing tests fail.
- [x] 2.3 Report image tests on the same rasters: every image pixel equals the exact render. Outside the raster: `NoRasterDataOverlapError`
- [x] 2.4 Overview tests on a synthetic COG with overviews: a low-zoom tile reads the coarsest overview finer than a tile pixel, a high-zoom tile reads the full resolution, and both match the exact render at their level

  A 1024-pixel COG with overviews of 2, 4, 8 and 16: a z10 tile reads the 4× overview, and a z15 tile the full resolution.

## 3. One resampling (D1–D3)

- [x] 3.1 `render_loss_mask(raster, bounds_3857, width, height)` in `app/utils/image_generation/loss_mask.py`: the output grid, the overlap check, the source level (D2) and `rasterio.warp.reproject` with nearest neighbour

  `source_level` picks the overview; `reproject` keeps GDAL's default approximation (see 2.1).
- [x] 3.2 `RasterDatasetCache` keeps the source, its bounds in EPSG:3857 and the overviews opened so far, instead of a `WarpedVRT`. Update `test_raster_dataset_cache.py`

  `CachedRaster`: `src`, `bounds_3857`, `dataset(level)`. A new test: overviews are opened once and closed with the raster.
- [x] 3.3 `get_tile` and `generate_deforestation_image_from_bounds` use it. Remove `RasterDataContext`. Update `test_get_tile` and the image generator tests

  `test_get_tile` now uses a real all-loss raster (format and colour; outside → empty tile) plus an unreadable raster → `HTTPException`.

  The numeric baseline's tile (`tests/numeric_baseline/baseline_tile.png`) changes on purpose: 185 of its 65,536 pixels, at the loss pixels' edges. It was regenerated in the reference environment (Python 3.11, numpy 1.26.4, rasterio 1.4.3), where the new tile is identical to the one under numpy 2 / rasterio 1.5.2. Only the tile changes; the fixture, the scalars and the masked raster don't.
- [x] 3.4 Run pytest, ruff, black and mypy

  399 tests pass. ruff, black and mypy are clean.

## 4. Tests of the ratio's formula

- [x] 4.1 A crop of the real GFW raster around `F-VALIDACION` as a fixture (its real grid and CRS), and a test through `/analize`: 0.25

  `tests/modules/deforestation_analysis/fixtures/gfw_validation_farm.tif`: 17 × 16 pixels of `app/maps`' `gfw.tif` with its grid (412 bytes). `test_analize_the_validation_farm_on_real_gfw_pixels`: 0.25. And `test_the_validation_farm_is_drawn_as_its_ratio_counts_it`: the share of the farm drawn red is 25% ± 0.5% (the old drawing showed 17.7%).
- [x] 4.2 The worked example of `docs/deforestation_calculation.md` on a synthetic UTM raster: 0.21

  A case of `test_get_loss_area_fraction`, in EPSG:4326 and UTM.
- [x] 4.3 Seeded random polygons on seeded random rasters, in EPSG:4326 and UTM, against the independent equal-area reference (union of loss pixels ∩ polygon, EPSG:6933): within 1e-6

  `test_get_loss_area_fraction_matches_an_equal_area_reference`: 25 star-shaped polygons of up to 6 pixels' radius on a 40 × 40 layer with 30% loss, per CRS.

## 5. Verification

- [x] 5.1 The same measurements as 1.1 after the change: no shift, and no zoom slower than before

  Same tiles as 1.1, ms per tile:

  | Raster | z6 | z8 | z10 | z15 |
  |---|---|---|---|---|
  | `layer-4-v1.tif` (COG): before → after | 4 → 2 | 7 → 2 | 5 → 2 | 3 → 2 |
  | `gfw.tif` (no overviews) | 2,755 → 389 | 284 → 46 | 29 → 4 | 4 → 2 |
  | `ecuador.tif` (UTM, no overviews) | 951 → 243 | 303 → 64 | 26 → 6 | 2 → 2 |

  The "before" column was measured again on these exact tiles, with a VRT opened per request as `dev` does.

  - **Report images:** reading the loss for one image (zoom 17) costs the same in EPSG:4326 (2.2 ms) and goes from 1.2 to 3.8 ms in UTM. A whole image without the satellite takes 5–6 ms, so a 1000-farm report with 2 UTM layers adds about 5 s of CPU, spread over the API's threads, to a job of about 3 minutes.
  - **No shift left:** around `F-VALIDACION`, 0% of the pixels differ from the exact render, for tiles at z16, z18 and z19 and for images at zoom 16, 17 and 18.
- [x] 5.2 In the local app: `F-VALIDACION` on the analysis map, and its report image, with the edges cutting the pixels as the ratio counts them

  With the API on this branch: the table reads 25%, and on the analysis map and in the report image (`/generate-image`) the farm's top edge cuts the top row of pixels in half and its side edges cut the corner pixels in four (`.context/scale/validacion-map.png`, `validacion-report-image.jpg`).

## 6. Close

- [x] 6.1 Docs: `docs/architecture.md` (how tiles and report images are drawn) and `docs/deforestation_calculation.md` (the map is exact to the pixel)

  The new section of `docs/deforestation_calculation.md` is "Checking it on the map".
- [x] 6.2 CHANGELOG, under Fixed

  It notes that browsers may keep cached tiles for up to a day: the tile URL only changes with the layer's version.
