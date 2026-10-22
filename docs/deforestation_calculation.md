# How the deforestation percentage is calculated

For each farm and layer, `POST /deforestation_analysis/analize` returns a **ratio from 0 to 1** (the web shows it as a percentage): the share of the farm's area that lies on the layer's loss pixels. It is not an area in hectares.

The code is `get_loss_area_fraction` in `apps/api/app/modules/deforestation_analysis/helpers.py`, called once per farm and layer by the router.

## The formula

```
ratio = Σ area(loss pixel ∩ farm polygon) / area(farm polygon)
```

Each loss pixel counts only by the part of it that lies inside the farm. If the polygon covers a third of a pixel, that pixel adds a third of its area, not the whole pixel.

## Step by step

1. **Reproject the farm to the raster's CRS.** The farm comes in latitude and longitude (EPSG:4326) and is reprojected to the layer's CRS. GFW and TMF are already in EPSG:4326; the MAATE layers are in UTM 17S, in metres. A farm given as a point is analysed as the circle built from its declared area.

2. **Read the pixels the farm touches.** `rasterio.mask(..., crop=True, all_touched=True)` crops the raster to the farm and includes every pixel the polygon touches, even barely. Pixels outside the polygon are filled as nodata, so they never count as loss.

3. **Keep the loss pixels**, the ones whose value is exactly `1`. If there are none, the ratio is 0.

4. **Draw each loss pixel as a square.** The raster carries an affine transform: the position of its corner and the size of each pixel. It turns each pixel's row and column into the coordinates of its four corners, which make the square (`shapely.polygons`, vectorized). The pixel's size comes from the raster itself, not from the `pixel_size` declared in the layers index. Building the corners through the transform also handles rasters that aren't north-up.

5. **Clip each square with the farm and measure it.** Shapely (GEOS) computes each square's intersection with the polygon (`shapely.intersection`).
   - The result is another polygon: the piece of the pixel inside the farm. Its vertices are the pixel's corners that are inside the farm, the farm's vertices that fall inside the pixel, and the points where the edges cross.
   - Its area comes from the **shoelace formula** (Gauss's area formula) over its vertices:

     ```
     A = ½ · | Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ) |
     ```

   - The pieces of every loss pixel are added up. The farm's area is computed with the same formula, in the same CRS, and the sum is divided by it.

6. **Keep it in range.** The ratio is clamped to [0, 1], only to absorb floating-point error at the pixels' edges. A pixel can't add more than its part inside the farm, so the ratio can't exceed 1 otherwise.

## Example

A farm of 1 ha (10,000 m²) on a 30 m UTM layer (900 m² per pixel):

- it covers 2 loss pixels in full: 2 × 900 = 1,800 m²;
- its edge crosses a third loss pixel and leaves a 300 m² trapezoid inside.

| Method | Calculation | Result |
|---|---|---|
| Before October 2026 (whole pixels) | 3 × 900 / 10,000 | 27% |
| Now (area inside the farm) | (1,800 + 300) / 10,000 | 21% |

## Units

Both areas are measured in the units of the raster's CRS:

- **In a projected CRS (UTM)** they are square metres, and exact.
- **In EPSG:4326** they are "square degrees". A degree of longitude shrinks with the latitude, but at a farm's scale (hundreds of metres) that distortion affects the numerator and the denominator equally, so it cancels in the division.

This was checked against an equal-area projection (EPSG:6933, the union of the loss pixels intersected with the farm) on real farms of the regression suite: equal to four decimals.

## The farm's geodesic area

`GeometryCalculator.calculate_polygon_area` (`apps/api/app/helpers/GeometryCalculator.py`, an Albers equal-area projection) no longer enters the ratio. It only decides whether the farm can be measured: an empty, invalid or zero-area polygon gets no ratio (`null`), and so does a farm outside the raster or one whose layer can't be read.

The deforested area in hectares, if it is ever shown, would be the ratio × the farm's geodesic area.

## Before October 2026

Every loss pixel the farm touched counted as a whole pixel:

```
ratio = min(1, loss pixels touched × pixel_size² / geodesic area of the farm)
```

A pixel the farm only grazed added 900 m², which over-estimated small farms and those with loss along their edge. Farm F0041 of the 500-farm reference upload (2.73 ha) showed 100% in GFW while 66.7% of its area lies on loss. In that upload, 3 to 6 farms per layer were flagged above the 2% threshold only because a loss pixel grazed their edge. In that upload (GFW, TMF and both MAATE layers) every percentage stayed equal or went down.

A percentage can also go up. The old formula used the layer's declared `pixel_size`, and the new one measures the raster's real cells. Where they are larger than declared, a farm fully on loss used to fall short of 100%: IDEAM's cells are 929.6 m², not 900, so such a farm went from 97% to 100%.

The details are in the archived OpenSpec change `openspec/changes/archive/2026-10-16-area-weighted-deforestation/`.

## Checking it on the map

The map and the report's images draw each loss pixel where the raster puts it, within
one image or tile pixel (see `docs/architecture.md`, "Map tiles"). So, at a zoom where
the raster's pixels are drawn at full resolution, the share of a farm drawn red is its
ratio. The farm `F-VALIDACION` of the tests (a rectangle along the centres of a 5 × 4
block of real GFW pixels in Orellana) reads 25%, and on the map its edges cut two loss
pixels in four and one in half. Before October 2026 the drawing was off by up to a
pixel, so a check by eye could disagree with a correct ratio.

The check only holds at those zooms. The ratio is always computed from the raster's
native pixels, but the map and the report's images read one of the raster's overviews
when an output pixel is at least twice the raster's: on the map, zoom 11 and below
for a 30 m layer; in a report image, a farm more than about 10 km across (zoom 11
or lower). An overview keeps one source pixel out of 2, 4, 8… per axis, so the red
share it shows is an approximation of the ratio, and the smaller the farm looks, the
coarser it is.

## The limit of the method

The precision stops at the pixel. When a layer marks a pixel as loss, the whole pixel (30 × 30 m, or 10 × 10 m in Costa Rica) is taken as lost forest. The calculation splits each pixel exactly between the farm and its surroundings, but it can't know where the loss was inside the pixel. That depends on each layer's resolution, not on the calculation.
