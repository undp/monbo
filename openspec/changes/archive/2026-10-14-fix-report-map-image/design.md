## Context

`POST /deforestation_analysis/generate-image` draws one image per (farm, map) for the report PDF. `MapImageGenerator.generate` works in three steps:

1. It computes the farm's bounds and picks the largest integer zoom at which those bounds, padded by 10% on each side, fit `MapDefaults.OUTPUT_SIZE` (`GoogleMapsAPIHelper.calculate_zoom_from_bounds`, per axis, keeping the smaller zoom).
2. It builds three layers of that size, all centered on the bounds' center at that zoom: the satellite image (or a solid background), the farm overlay (fill and outline), and the deforestation mask.
3. It alpha-composites the layers in list order, bottom to top.

The web places the image on the farm page (`sections.tsx`) in a container with `maxHeight: 370` and the image at `width: 100%`, `height: 95%` and `objectFit: "cover"`. On an A4 page with 30 pt padding, that box is about 535×351 pt (ratio ≈1.52), while the image is 500×500 (ratio 1).

```
  generate()                                 PDF farm page
  ┌──────────────────────┐ 500
  │░░░░ cropped (~17%) ░░│
  ├──────────────────────┤           ┌──────────────────────┐
  │   farm fits here     │   cover   │  only ~65% of the    │ ~351 pt
  │   (≤ ~83% of height) │  ───────▶ │  height is visible   │
  ├──────────────────────┤           └──────────────────────┘
  │░░░░ cropped (~17%) ░░│                    535 pt
  └──────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- The farm's outline is visible over the deforestation everywhere.
- The whole farm, with its padding, is visible in the PDF whatever its shape.
- The farm page keeps its current layout (the map box stays about 535×351 pt).

**Non-Goals:**
- Changing the zoom algorithm (padding, integer zoom) or the colors.
- Higher-resolution images (`scale=2`).
- Drawing polygon holes.

## Decisions

### 1. Composite order: background → deforestation → farm

Move the farm overlay after the deforestation overlay in `MapImageGenerator.generate`, and update its docstring.

- **Why:** it is a one-line change, and it matches the web map, where the deforestation tiles (`overlayMapTypes`) are drawn under the polygons. The 16% yellow fill over the red marks the loss that falls inside the farm, which is what the report is about.
- **Alternative: background → fill → deforestation → outline.** It keeps the red unaltered inside the farm, but `_generate_polygon_overlay` composites fill and outline into one image today, and the point overlay draws both in one `ellipse` call. Both would have to be split for a cosmetic difference. Rejected.

### 2. Generate the image in the PDF box's aspect ratio: 640×420

Change `MapDefaults.OUTPUT_SIZE` to `(640, 420)`. Nothing else in the API changes: the zoom, the satellite request (`size=640x420`), the polygon and point overlays and the deforestation raster (`from_bounds(..., width, height)`, `out_shape=(height, width)`) all take `output_size` already.

- **Why 640×420:** 640/420 ≈ 1.524, the same as the 535×351 pt box. 640 px is the largest width Static Maps serves without `scale` or a premium plan, so the PDF gets ~1.2 px/pt instead of ~0.93.
- **Why fix the size in the API, not in the PDF:** the zoom is chosen for the image's frame. Only an image with the box's aspect ratio makes "fits the image" equal to "fits the PDF".
- **Alternative: `objectFit: "contain"` with the square image.** The square would show at 351×351 pt with white bands on both sides. Rejected: it shrinks every map by a third.
- **Alternative: more padding.** It would shrink every farm to save the tall ones, and still wouldn't guarantee the fit. Rejected.
- **Alternative: a `size` parameter on the endpoint.** Only the report calls `/generate-image`. Not needed now; it can be added when a second consumer appears.

### 3. Fix the PDF box to the image's ratio and use `contain`

In `styles.ts`, give the map image an explicit size: the page's content width (`595.28 − 2 × 30` pt) by that width × 420/640 (≈351 pt). Use `objectFit: "contain"`. Drop the container's `maxHeight: 370` and the image's `height: 95%`, so the container's height is the image plus the disclaimer, as today.

- **Why explicit sizes:** `height: 95%` of a container that only has a `maxHeight` is fragile; an explicit width and height make the ratio exact.
- **Why `contain`:** with matching ratios, `contain` and `cover` render the same. If the ratios ever drift (a new API size, a different page padding), `contain` adds thin bands instead of cutting the farm again.
- The 640/420 ratio is written once on each side (API constant and a web style constant), each with a comment pointing to the other.

## Risks / Trade-offs

- **[The ratio is duplicated in the API and the web]** → a comment next to each constant names the other file. `contain` makes a drift visible (bands) instead of harmful (crop).
- **[Cached satellite images from before the deploy]** → the cache key includes the size, so old entries are simply not reused. They expire after 10 minutes.
- **[Static Maps cost]** → unchanged: one request per farm at the same price for any size up to 640×640.
- **[Wider frame shows more surroundings]** → for wide farms the zoom may now be one level higher (more width available), and for tall farms one level lower. Both fit within the frame by construction.
- **[Red tinted inside the farm]** → intended (see decision 1). If the team prefers pure red, decision 1's alternative remains possible later.

## Migration Plan

Deploy the API and the web together, or the API first: a 640×420 image in the current web is barely cropped by `cover`, since its ratio is already the box's, and a 500×500 image in the new web shows with bands. Neither breaks the report. Rollback: revert both commits.
