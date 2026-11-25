## Context

The API draws loss pixels in two places:

- **Map tiles:** `GET /deforestation_analysis/tiles/{country}/{id}/dynamic/{z}/{x}/{y}.png` → `get_tile` in `app/modules/deforestation_analysis/helpers.py`. Each request opens the raster and a `WarpedVRT` to EPSG:3857 (`RasterDataContext`), reads the tile's window with `out_shape=(256, 256)` and nearest-neighbour resampling, and paints the pixels equal to 1.
- **Report images:** `RasterManipulationHelper.generate_deforestation_image_from_bounds`. It reads the image's window, at the image's size, from a `WarpedVRT` kept open by `raster_dataset_cache`.

Neither `WarpedVRT` is given a grid. GDAL picks one for the whole raster: its own origin, and square pixels of 30.087 m for GFW. A GFW pixel (0.000269°) is 30.000 m wide in EPSG:3857 and 30.0 to 30.9 m tall, growing with the latitude. The two grids can't align, so nearest-neighbour resampling onto the VRT's grid moves each pixel's edges by up to one pixel. The tile or image then resamples a fractional window of that grid a second time.

Measured around the validation farm (`F-VALIDACION`, edges on GFW's pixel centres):

| Output | Shift | Pixels that differ from an exact render |
|---|---|---|
| Tile z16 / z18 / z19 | 13–14 m | 5.2% / 10.8% / 28.5% |
| Report image, zoom 16 / 17 / 18 | 12–14 m | 3.6% / 6.8% / 4.5% |

The VRT does have one strength: reading a coarse window at a small `out_shape` uses the raster's overviews. Admin uploads are COGs with overviews down to 1/256, so a z6 tile takes 16 ms.

## Goals / Non-Goals

**Goals:**
- Every pixel of a tile or report image shows the value of the source pixel under its centre, so a loss pixel's edges are drawn where the raster puts them. The tolerance is the output pixel (nearest neighbour).
- No slower than today at any zoom, on a COG with overviews and on a raster without them.
- Tests that fail if the drawing drifts again, and more tests of the ratio's formula on real data.

**Non-Goals:**
- Changing the ratio, the routes, the image's size, colours or layer order, or the tile caching headers.
- Re-rendering reports already downloaded.
- Building overviews for local roots copied with `migrate_countries`, which have none.

## Decisions

### D1. One resampling, from the source onto the output's grid

`render_loss_mask(raster, bounds_3857, width, height) -> np.ndarray | None` (new, in `app/utils/image_generation/loss_mask.py`):

1. **The output grid:** `from_bounds(*bounds_3857, width, height)` in EPSG:3857. A tile's bounds come from `mercantile.xy_bounds`; a report image's from the satellite image's bounds, as today.
2. **No overlap:** if the bounds don't intersect the raster's bounds in EPSG:3857 (computed once per opened raster), it returns `None`.
3. **The source level:** see D2.
4. **The resampling:** `rasterio.warp.reproject(rasterio.band(dataset, 1), out, dst_transform, dst_crs="EPSG:3857", resampling=nearest)`. Pixels outside the raster and nodata pixels are never 1.
5. **The result:** the boolean mask `out == 1`.

`get_tile` and `generate_deforestation_image_from_bounds` both call it.
- **Tiles:** `None` gives the empty tile, as today.
- **Report images:** `None` raises `NoRasterDataOverlapError` (404), as today.

**Alternatives:**
- **A `WarpedVRT` per output with an explicit `transform`/`width`/`height`.** It aligns too, but it reads the full resolution at low zoom: 1,616 ms for a z6 tile of a COG, against 16 ms today.
- **Keeping the shared VRT with a grid aligned to the source.** Not possible: a geographic grid's rows aren't evenly spaced in Web Mercator.

### D2. Overviews chosen by the output's pixel size

The output's pixel size in the source's CRS comes from transforming its bounds (`transform_bounds`). The source level is the coarsest overview whose pixel is still at most that size. When there is none, it is the full resolution.

- **Low zoom:** an overview's grid is a decimation of the source grid, so its pixels are aligned with it. At these zooms its pixel is under one output pixel, so it can't move an edge by more than that.
- **High zoom:** where alignment shows (a source pixel spans several output pixels), no overview is fine enough, and the full resolution is read.
- **Opening an overview:** `rasterio.open(path, overview_level=i)`, opened lazily and kept with the raster in the cache.

| Prototype, ms per tile | z6 | z8 | z10 | z15 |
|---|---|---|---|---|
| COG with overviews (admin upload): today | 16 | 18 | 10 | 6 |
| COG with overviews: D1 + D2 | 18 | 3 | 2 | 2 |
| GFW without overviews (Git): today | 2,663 | 200 | 25 | 5 |
| GFW without overviews: D1 + D2 | 243 | 60 | 14 | 2 |

### D3. One cache for tiles and images

`RasterDatasetCache` keeps, per path:
- the source dataset;
- its bounds in EPSG:3857;
- the overview datasets opened so far.

There is no `WarpedVRT` anymore. It is still checked against the file's mtime and size on every read, holds one lock per raster, and evicts the least recently used.

`get_tile` reads through it, so a tile no longer opens the raster on every request. `RasterDataContext` is removed: nothing else uses it.

### D4. Tests

- **Where the pixels are drawn:** a synthetic raster in EPSG:4326 and one in UTM 17S, each with a random loss pattern, so any shift changes many pixels (plus one in EPSG:4326 at 10° N, where the old VRT grid drifts). For tiles at several zooms and for a report image, every output pixel must equal an exact render: the source pixel under the output pixel's centre, computed independently with `pyproj` and the raster's inverse transform. They fail on today's code.
- **Overviews:** a synthetic COG with overviews. A low-zoom tile reads an overview, and a high-zoom tile reads the full resolution (asserted on the chosen level). Both match the exact render at their level.
- **The cache:** the existing tests move from the VRT to the source and overviews. Reopening on a changed file and LRU eviction still close every dataset.
- **The ratio's formula:**
  - **Real data:** `F-VALIDACION` on a crop of the real GFW raster around it (a few KB GeoTIFF with the real grid, like the regression fixtures), through `/analize`: 0.25.
  - **The documentation's worked example** on a synthetic UTM raster: 0.21.
  - **Random cases:** seeded random polygons on seeded random rasters, in EPSG:4326 and UTM, compared with an independent reference: the union of the loss pixels (`rasterio.features.shapes`) intersected with the polygon, measured in an equal-area projection (EPSG:6933). Tolerance 1e-6.

## Risks / Trade-offs

- **[The red moves by up to a pixel for users]** → It moves to where the raster puts it. The CHANGELOG says so under Fixed. Reports downloaded before keep the old drawing.
- **[`overview_level` handles per raster]** → At most 9 per raster, only opened when a zoom needs them, and closed with the raster.
- **[Low-zoom tiles of rasters without overviews]** → A z6 tile reads the full resolution. It is still 10× faster than today (243 ms against 2,663 ms). In Azure every layer is a COG with overviews: both the seed and the admin's uploads convert them. Only a local root copied with `migrate_countries` lacks them.
- **[Report images in UTM]** → Reading the loss for an image goes from 1.2 to 3.8 ms (the exact transverse Mercator transform). In EPSG:4326 it is unchanged. About 5 s of CPU for a 1000-farm report with 2 UTM layers.
- **[Cached tiles]** → Browsers keep a tile for a day, and its URL only changes with the layer's version. After the deploy, some users may see the old drawing for up to a day.
- **[GDAL's approximation of the transform]** → Kept: exact costs 5× per tile in UTM, and it only moves output pixels whose centre is within 0.0004 of a source pixel from its edge. The tests allow that much (0.001).
- **[The test fixture is real data]** → A crop of tens of pixels of GFW, under the same licence as the regression fixtures.
