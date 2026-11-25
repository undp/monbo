## Why

The map image on each farm page of the report PDF has two defects that make it misleading:

- **The farm's outline is drawn under the deforestation.** `MapImageGenerator.generate` composites satellite → polygon → deforestation, so the red pixels (71% opaque) hide the yellow outline wherever the loss crosses the farm's edge. The reader can't tell which loss is inside the farm. The web map does the opposite: its deforestation tiles (`overlayMapTypes`) sit under the drawn polygons.
- **Tall farms are cut off at the top and bottom.** The API draws a 500×500 square and picks the zoom so the farm fits that square, but the PDF shows it in a ~535×351 pt box with `objectFit: "cover"`, which crops ~17% off the top and the bottom. Any farm taller than ~65% of the square loses its ends. Wide farms are never cut, because the width fits exactly.

## What Changes

- **Layer order:** the image is composited satellite (or solid background) → deforestation → farm (fill and outline). The outline is always visible, and the 16% yellow fill tints the loss that falls inside the farm.
- **Image size:** `POST /deforestation_analysis/generate-image` returns a **640×420** image instead of 500×500. The zoom, the satellite request, the deforestation raster and the overlay are already computed for the requested size, so the farm fits the new frame with the same 10% padding. 640 px is Static Maps' maximum width without `scale`, which also makes the image slightly sharper in the PDF.
- **PDF frame:** the map image keeps the image's aspect ratio (640:420) and uses `objectFit: "contain"`, so the PDF never crops the image even if the layout squeezes the box.
- The report's response shape doesn't change. Its dimensions do, which the `report-generation` spec pins.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `report-generation`: "Report images are JPEG" pins the image at 500×500; it becomes 640×420. New requirements: the farm is drawn above the deforestation, and the PDF shows the whole image without cropping.

## Impact

- **API:**
  - `app/utils/image_generation/MapImageGenerator.py` (layer order, docstring);
  - `app/utils/image_generation/constants.py` (`MapDefaults.OUTPUT_SIZE`).
- **Web:** `src/utils/deforestationReport/styles.ts` (`farmMapPageMapImageContainer`, `farmMapPageMapImage`).
- **Tests:** `tests/modules/deforestation_analysis/test_router.py` asserts 500×500 and changes to 640×420. New unit tests for the layer order and for a tall farm's fit.
- **Google Static Maps:** the satellite cache key includes the size, so cached entries from before the deploy are simply not reused (10-minute TTL). Cost per request doesn't change.
- **CHANGELOG:** "Fixed" for both defects.

### Out of scope
- **Fractional zoom:** Static Maps only takes integer zooms, so a farm fills between ~42% and ~83% of the frame. Not a crop; left as is.
- **Polygon holes** are already rejected at upload (`fix-polygon-edge-cases`); the overlay keeps drawing only the exterior ring.
- **Higher resolution** (`scale=2`): would double the satellite pixels and every overlay. Not needed to fix these defects.
