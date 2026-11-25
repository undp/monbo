## Why

The loss pixels the app draws are not where the raster puts them.

- **Seen while validating the area-weighted ratio by hand.** A farm built with its edges exactly on the pixel centres of GFW (`F-VALIDACION`) reads 25%, as it should. But on the analysis map its red pixels sit about **13 m up and to the left** of the farm, almost half a pixel. The edge that should cut the top row of pixels in half runs along their bottom.
- **The ratio is not affected:** `/analize` reads the raster directly. Only the drawings are off.
- **Measured** against an exact render (each output pixel's centre looked up in the source raster), on GFW around the validation farm:

  | Zoom | Shift of the tile | Tile pixels that differ |
  |---|---|---|
  | 16 | 14 m down-right | 5.2% |
  | 18 | 13 m down-right | 10.8% |
  | 19 | 13 m down-right | 28.5% |

- **The report images have the same offset:** 12–14 m down-right for the validation farm's image at zoom levels 16, 17 and 18 (3.6–6.8% of the pixels differ).
- **The cause is a double resampling.**
  - Both the map tiles (`get_tile`) and the report images (`RasterManipulationHelper`) read from a `WarpedVRT` of the whole raster in EPSG:3857, created without a grid. GDAL gives it a grid of its own: 30.087 m pixels, constant, while a GFW pixel is 30.000 × 30.0–30.9 m in EPSG:3857 depending on the latitude.
  - Nearest-neighbour resampling onto that grid moves every pixel's edges by up to one pixel. The mismatch accumulates (0.087 m per pixel), so the shift goes from 0 to a full pixel across the map, and every ~345 pixels one is drawn twice or dropped.
  - Each tile or image then reads a fractional window of that grid and resamples it again to its own size.
- **Why now:** the area-weighted ratio (`area-weighted-deforestation`) counts the part of each pixel inside the farm, so users now compare the percentage with what they see at pixel level. A drawing off by half a pixel makes a correct percentage look wrong.

## What Changes

- **Loss pixels are drawn where they are.** Map tiles and report images reproject the raster in one step, from the source onto the output's own grid (`rasterio.warp.reproject`, nearest neighbour). There is no intermediate grid.
- **Overviews stay in use.** At low zoom the source is read from the coarsest overview whose pixel is still finer than an output pixel, as the `WarpedVRT` did implicitly. At the zooms where a source pixel spans several output pixels, the full-resolution raster is used, so the edges are exact.
- **Tiles use the raster cache.** `get_tile` reads through `raster_dataset_cache` like the report images, instead of opening the raster and a `WarpedVRT` on every request. `RasterDataContext` goes away.
- **Tests that check where the pixels are drawn.** Tiles and report images are compared with an exact render of a synthetic raster, in EPSG:4326 and in UTM. Today `get_tile` is only tested with a mocked raster.
- **More tests of the ratio's formula:**
  - the validation farm on a crop of the real GFW raster, through `/analize` (25%);
  - the worked example of `docs/deforestation_calculation.md` (21%);
  - random polygons on random rasters, checked against an independent equal-area computation.
- **Unchanged:** the ratio, the API's routes and responses, the image's size, colours and layer order, the tile URLs and their caching.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deforestation-analysis`: a new requirement, "The map draws loss pixels where they are", and a scenario for the validation farm in "Deforestation ratio per farm and layer".
- `report-generation`: a new requirement, "Report images draw loss pixels where they are".

## Impact

- **API:**
  - `app/modules/deforestation_analysis/helpers.py` (`get_tile`);
  - `app/utils/image_generation/RasterManipulationHelper.py`;
  - `app/utils/image_generation/RasterDatasetCache.py` (sources and overviews instead of a `WarpedVRT`);
  - a new shared renderer of a loss mask onto a Web Mercator grid;
  - `RasterDataContext.py` removed.
- **Tests:**
  - `tests/modules/deforestation_analysis/test_helpers.py` (tiles; the formula);
  - `tests/utils/test_map_image_generator.py` and `test_raster_dataset_cache.py`;
  - a small crop of the real GFW raster around the validation farm, as a test fixture.
- **What users see:** the red pixels move by up to one pixel on the map and in new reports. No result changes.
- **Performance:** measured per tile against today, on a COG with overviews (an admin upload) and on a raster without them (the Git-tracked GFW). It must not be slower at any zoom.
- **Docs:** `docs/architecture.md` (tiles and images), `docs/deforestation_calculation.md` (the map is now exact to the pixel), CHANGELOG (Fixed).
