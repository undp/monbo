## Why

Generating the deforestation report is slow and expensive, and the cost grows with farms × maps:

- **The download fetches every image a second time.** The preview page (`useDeforestationCompleteReportDocument`) fetches one image per (farm, map). The download buttons on that same page (`useDeforestationReportDownload`) call `fetchDeforestationImages` again and render the PDF from scratch. The code already flags this as `// TODO: improve the performance of fetching the images`.
- **The satellite background is fetched once per (farm, map), but it only depends on the farm.** Its center and zoom come from the geometry. The map only changes the red deforestation overlay. With 3 maps, every farm costs 3 paid Google Static Maps calls instead of 1. Above `NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` (100), the report loses the satellite background altogether.
- **The images are 500×500 RGBA PNGs.** `@react-pdf` has to decode each one in JavaScript, split out the alpha channel and recompress it, all on the main thread. A JPEG goes into the PDF almost as-is, and the PDF is several times smaller.
- **The API repeats work and blocks its event loop.**
  - It creates a new `httpx.AsyncClient` per request, so there is no connection reuse to Google.
  - It reopens the raster and its `WarpedVRT` per request.
  - It runs the PIL overlay, compositing and encoding synchronously in the event loop. The single uvicorn worker therefore stalls the tiles and every other request while a report is generating.
- **The browser freezes during render.** `pdf().toBlob()` and `<PDFViewer>` run on the main thread. The fonts are downloaded from `fonts.gstatic.com` on every generation. A 211 KB cover image is embedded in every PDF, including each of the N PDFs in the separated-reports ZIP.

The PDF stays client-side (`@react-pdf`). Moving it to the server was considered and set aside: it would mean rewriting ~800 lines of report layout in Python and duplicating i18n, and it would load an API that runs as a single replica.

## What Changes

- **The web fetches each report's images once.**
  - The preview and both downloads (complete and separated) share the same images.
  - Blob URLs are revoked when the selection changes or the page unmounts.
- **The API fetches each satellite background once.**
  - An in-memory cache keyed by (center, zoom, size) deduplicates in-flight requests, so concurrent calls for the same farm share one Google call.
  - The `/generate-image` request contract does not change.
- **`/generate-image` returns JPEG.** The response is `image/jpeg` instead of `image/png`. The OpenAPI doesn't declare the media type, so the generated web types don't change. The polygon outline and the deforestation pixels must stay legible; this is checked visually.
- **The API stops repeating work and blocking.**
  - One `httpx.AsyncClient` is shared through the app's lifespan.
  - Opened rasters and their VRTs are cached per (path, version).
  - The CPU-bound image steps run in threads.
- **The web renders faster and stays responsive.**
  - The PDF renders in a Web Worker.
  - The Roboto fonts are served from `/public`.
  - The cover image is lighter.
  - The separated-reports ZIP no longer repeats work that is identical across farms.
- **The satellite threshold is revisited.** Once the satellite calls drop to one per farm, `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` should count unique farms, not (farm, map) pairs.

Out of scope: generating the PDF on the server; changing the report's layout or content.

## Capabilities

### New Capabilities

- `report-generation`, covering how the report's images are fetched and reused:
  - preview and download share them;
  - one satellite background per farm;
  - their format.

  It also covers rendering the PDF without blocking the UI and without third-party font requests.

### Modified Capabilities

None. No existing spec covers report generation, and `api-contracts` is unaffected because the request and response schemas don't change.

## Impact

- **Web:**
  - `src/hooks/useDeforestationCompleteReportDocument.tsx` and `src/hooks/useDeforestationReportDownload.tsx`, which share images and the rendered blob;
  - `src/utils/deforestationImages.ts` (threshold by unique farms);
  - `src/utils/deforestationReport.tsx` (fonts);
  - a new PDF worker and its i18n and runtime-config bootstrap;
  - `src/components/page/reportGeneration/preview/*` (the preview from a blob instead of `<PDFViewer>`);
  - `public/fonts/`, `public/images/deforestationReportCoverBackgroundLeaf.png`.
- **API:**
  - `app/modules/deforestation_analysis/router.py` (JPEG, encoding in a thread);
  - `app/utils/image_generation/{MapImageGenerator,GoogleMapsAPIHelper,RasterDataContext,RasterManipulationHelper}.py`;
  - `app/main.py` (lifespan: the shared HTTP client);
  - tests (`test_router.py` asserts `image/png` today).
- **Cost:** fewer Google Static Maps calls, by a factor of about the number of selected maps.
- **Memory:** the API holds a bounded LRU of satellite images (500×500, ~1 MB decoded each) and of open VRTs. This is acceptable with one replica.
- **Deploy:** the API and web deploy together. An old web against the new API still works, because it reads the blob regardless of its format.
