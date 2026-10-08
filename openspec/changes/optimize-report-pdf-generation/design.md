## Context

The report is generated entirely in the browser with `@react-pdf/renderer`, from images the API generates one at a time:

```
 /report-generation/preview
 ─────────────────────────────────────────────────────────────────────
  useDeforestationCompleteReportDocument
    ├─ fetchDeforestationImages ──► N = farms × maps POST /generate-image (pLimit 20)
    │                                   API, per request:
    │                                   ├─ Google Static Maps (new httpx client)
    │                                   ├─ rasterio.open + WarpedVRT
    │                                   ├─ PIL overlay (3× supersampling), composite   ← event loop
    │                                   └─ PNG RGBA 500×500                            ← event loop
    └─ <PDFViewer> renders the document (main thread, showLinks=false)

  PageFooter / DownloadTypeSelectionModal → useDeforestationReportDownload
    ├─ fetchDeforestationImages      ◄── the same N requests again
    └─ pdf(...).toBlob()             (main thread; separated: one per farm, then JSZip)
```

Facts that shape the design:

- **Request order.** `fetchDeforestationImages` builds its payloads map-major (maps outer, farms inner). With `pLimit(20)` and more than 20 farms, the requests for the same farm are far apart in time.
- **What the satellite image depends on.** It is a function of the geometry's center, the zoom (from the geometry's bounds and the output size) and the output size. The map doesn't enter.
- **Raster paths are versioned.** A raster path names its version (`layer-1-v3.tif`), and a new raster gets a new filename. A path therefore identifies one immutable file.
- **The API runs one replica with one uvicorn worker.** In-memory state is shared by every request.
- **The OpenAPI doesn't declare the response media type of `/generate-image`.** The web reads the response with `response.blob()`.
- **The PDF's inputs.**
  - The PDF reads `t` (i18next) and the runtime config (`getDeforestationThreshold`, through `utils/numbers.ts`).
  - It also reads `DOWNLOAD_GEOJSON_URL`, a `__NEXT_PUBLIC_*__` placeholder that `entrypoint.sh` substitutes in every `.next/static/**/*.js`, worker chunks included.
  - Its static images use root-relative paths (`/images/...`).
- **Why the preview has no links.** Commit 4234b94 hid them because clicking one navigated the previewer away. The downloads keep them.
- **What the report actually uses.** Roboto at weights 400, 500 and 700, no italics. `deforestationReportCoverBackgroundLeaf.png` is a 400×460 RGBA PNG of 211 KB.

## Goals / Non-Goals

**Goals:**

- Each (farm, map) image is generated once per selection, and each farm's satellite image is fetched from Google once.
- A smaller and cheaper image path: JPEG, a shared HTTP client, cached rasters, and no blocking of the event loop.
- A UI that doesn't freeze while the PDF renders, and no third-party requests at render time.
- Measured: before and after timings for a reference report (see the tasks).

**Non-Goals:**

- Server-side PDF generation.
- Changing the report's layout, texts or numbers.
- A persistent or shared cache across replicas or restarts.
- Higher image resolution, or retina images.

## Decisions

### D1. A report-scoped image store in the web

`ReportProvider` (`src/context/ReportContext.tsx`) wraps the preview page. The preview and `useDeforestationReportDownload` get their PDFs from it, and it fetches the images; nothing else calls `fetchDeforestationImages`. `useDeforestationCompleteReportDocument` is gone.

- **Cache key.** It is derived from the selection: country, locale, the sorted `(mapId, version)` pairs and the sorted farm ids.
  - The images, the preview and the pre-rendered download are each one promise per key, so a second call (React's dev double mount, a click before the preview ends) reuses the one in progress.
  - A failed promise is forgotten, so the next call retries.
- **Blobs, not URLs.** The images stay `Blob`s on the main thread; the worker creates and revokes their object URLs (D6). The only object URL on the page is the preview's, which is revoked when it's replaced and on unmount.
- **Errors.**
  - `MapLayerChangedError` keeps triggering `invalidateAnalysis()`, as today.
  - Any other preview error replaces the spinner with an error and a "Retry" button (`reportGeneration:preview:error` / `retry`, new in en and es). The failed promise is forgotten, so the retry fetches or renders again. Before, the error was unhandled.
- **Alternative: TanStack Query or SWR.** Neither is a dependency today. Adding one for a single cached call isn't worth it.
- **Alternative: keep the images in `DataContext`.** That context already holds a lot. A provider scoped to the report page releases the blobs when the user leaves the page.

### D2. A satellite image cache in the API, with in-flight dedup

In `GoogleMapsAPIHelper`, a module-level async cache wraps `get_google_maps_satellite_image`.

- **Key.** `(round(center_lat, 7), round(center_lon, 7), zoom, width, height, map_type)`.
- **Value.** An `asyncio.Task` that resolves to the response **bytes** (Google's compressed image, ~100–300 KB), not to a decoded PIL image. Every caller decodes its own copy, so nothing mutates a shared image.
- **In-flight dedup.** The second caller awaits the same task.
- **Failures.** A task that raises is removed, so a failure is never cached.
- **Bounds.** LRU of 256 entries (≤ ~75 MB) and a short TTL (10 minutes). The cache exists to dedup one report's requests, not to store imagery (see Risks).

**The web sends the requests by groups of 64 farms, map-major within each group** (`FARMS_PER_GROUP` in `utils/deforestationImages.ts`), through one `pLimit(20)` queue. Within a group, the first map's requests fill the cache and the following maps hit it. Between a farm's first and last request there are at most 63 other farms, so the 256-entry LRU keeps every farm's image until its last map, whatever the number of farms in the report (with the limit unset, D5, or above 256 farms), and with room for other reports in flight at the same time. A single map-major pass over the whole report would thrash the LRU above 256 farms (257 farms × 2 maps: 514 Google calls instead of 257). Up to 64 farms the order is the same as the measured map-major one.

- **Alternative, measured and discarded: farm-major order.** The original idea was to send each farm's M requests together, so they share the in-flight task whatever the number of farms. Measured with the reference report (tasks 2.7): 5.2 s versus 2.5 s for map-major, with the same 50 Google calls. With `pLimit(20)`, farm-major has only ~7 Google calls in flight; map-major has 20.

- **Alternative: a batch endpoint (`mapIds: [...]` per farm).** It saves the round trips too, but it changes the contract (Pydantic, the OpenAPI, the generated TS types and the web's error handling for each image) for a gain the cache already captures.
- **Alternative: an HTTP cache in the browser.** Not possible: these are POSTs with signed URLs on the server.

### D3. JPEG at quality 85, 4:4:4, from `/generate-image`

After compositing, the endpoint converts the image to RGB (it's opaque: the satellite or solid background covers it) and saves it as JPEG with `quality=85, subsampling=0`.

- **Why 4:4:4.** Chroma subsampling would blur the yellow outline and the red deforestation pixels, which are exactly the details that matter.
- **What changes for the web.** `@react-pdf` sniffs the image format from the bytes, so the web needs no change beyond the content type it receives.

- **Alternative: a palette or RGB PNG.** Smaller than RGBA, but `@react-pdf` still inflates and recompresses PNGs in JavaScript. JPEG goes into the PDF as DCT data, untouched.
- **Alternative: WebP.** `@react-pdf` doesn't embed it.

The tile endpoint (`router.py:136`) keeps PNG: map tiles need transparency.

### D4. The API stops repeating work and blocking

- **Shared HTTP client.**
  - The app's `lifespan` creates one `httpx.AsyncClient` with a `timeout=10` and connection limits, and closes it on shutdown.
  - `GoogleMapsAPIHelper` gets it through a small accessor.
  - Tests and scripts that don't run the lifespan fall back to a lazily created client.
- **Raster cache.**
  - An LRU (16 entries) of `(src, WarpedVRT)` keyed by raster path. Paths are versioned (see Context), so a new raster is a new key and stale entries age out. Eviction closes both handles.
  - GDAL dataset handles are not thread-safe, so each entry carries a `threading.Lock` held during `vrt.read`. A 500×500 window read is short. If it turns out to contend, the fallback is one entry per thread.
- **No blocking.** `MapImageGenerator.generate` runs the overlay, the compositing and the JPEG encoding through `run_in_threadpool`. The raster read already does, through `asyncio.to_thread`. The router stops encoding in the event loop.

- **Alternative: more uvicorn workers.** This is off the table: the admin keeps its locks, rate limit and ingestion slot in memory and depends on a single process (`infra/terraform/apps/api.tf`).

### D5. The satellite limit counts farms

`includeSatelitalBackground` compares the number of distinct farm ids among the payloads with `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION`. The variable's name stays, to avoid a configuration change across `.env.*`, `entrypoint.sh` and Terraform. Its meaning, Google calls per report, is now accurate again. The READMEs document it.

### D6. The PDF renders in a Web Worker

A module worker, `src/workers/reportPdf.worker.tsx`, is loaded with `new Worker(new URL(..., import.meta.url), { type: "module" })`, which Turbopack supports. It is wrapped in a small promise-based client (`ReportPdfClient.render(request) → Blob`, `src/workers/reportPdfClient.ts`) without adding Comlink. `ReportProvider` (`src/context/ReportContext.tsx`) owns the client, the images (D1) and the renders.

- **What the main thread sends** (`src/workers/reportPdfProtocol.ts`):
  - `kind`: `"complete"` or `"perFarm"`;
  - farms, results and maps;
  - the image `Blob`s by `(mapId, farmId)`; the worker creates its own object URLs and revokes them when it finishes;
  - `locale` and `showLinks`;
  - the runtime config (the thresholds).
- **How the worker boots.**
  - **i18n:** it runs the same `initTranslations` as the pages, whose locale JSONs are already bundled, for the report's namespaces (`reportGeneration`, `common`, `deforestationAnalysis`). Sending the bundles (the first idea) wasn't needed.
  - **Config and fonts:** it calls `setRuntimeConfig` and registers the fonts.
  - **Static URLs** are made absolute from `globalThis.location.origin` (`assetUrl`), so no `origin` is sent.
  - **Complete report:** it renders the document with `pdf().toBlob()`.
  - **Separated reports:** it renders one PDF per farm in the same worker, so `@react-pdf`'s font and image caches are reused across farms. It then builds the ZIP with JSZip in the worker and returns a single blob.
- **One worker per page.** The worker is created lazily and reused while the page lives. It is terminated on unmount.
- **The preview.**
  - `<PDFViewer>` (itself an iframe over a blob URL rendered on the main thread) is replaced by an `<iframe src={blobUrl + "#toolbar=0"}>` over the blob the worker returns.
  - The preview keeps `showLinks=false` (4234b94).
- **The complete download is pre-rendered.** As soon as the preview blob is ready, the worker renders the complete report with links in the background. The order is "preview first, then download", so pre-rendering never delays the preview.
  - **The click.** "Download" saves the pre-rendered blob. If the user clicks before it is ready, the click awaits that same render instead of starting another one.
  - **Selection changes.** The pre-rendered blob is discarded with the images (D1). A render still in progress for the old selection has its result ignored.
  - **Separated reports.** They are not pre-rendered. That would cost one render per farm on every visit to the preview, for a download fewer people use. They render on click in the worker, from the provider's images, without fetching.

- **Alternative: keep `<PDFViewer>` for the preview and use the worker only for downloads.** The preview is the first and largest render, and the one the user waits on, so it is where the freeze shows the most.
- **Alternative: one render shared by the preview and the download.** That would need links in the preview, and 4234b94 removed them on purpose. The background pre-render gives an instant click without bringing them back.
- **Alternative: render on click.** It is simpler, but on the reference report the user would wait for a full render after clicking. The extra render per visit is the accepted cost.

### D7. Local assets

- **Fonts.** Roboto 400, 500 and 700 go in `public/fonts/roboto/`, with the license file. Only the weights the report uses are registered. The unused italics, 300 and 900 are dropped, after checking the dynamic `fontWeight` in `sections.tsx`.
- **The leaf image.** It is quantized to a palette PNG with alpha (pngquant or equivalent), aiming for ≤ 60 KB with no visible change. It overlaps the other cover backgrounds, so it keeps transparency.
- **Static URLs.** The report's paths become absolute (`assetUrl`, from `globalThis.location.origin`), so they resolve the same in the window and in the worker.

## Risks / Trade-offs

- **[The Google Maps Platform terms restrict caching Content]** → The cache only deduplicates requests within one report: a 10-minute TTL, in memory, never persisted, never served to another user as a product feature. The project owner approved the 10-minute TTL (2026-10-07). If the terms or that decision change, dropping to in-flight dedup alone would need the farm-major order (slower, see D2) to keep the savings.
- **[An extra render on every visit to the preview]** (the pre-rendered download) → It runs in the worker after the preview, so neither the preview nor the UI waits for it. Its blob is held only for the current selection.
- **[JPEG artifacts on the thin yellow outline and isolated red pixels]** → Quality 85 at 4:4:4. A visual check on the regression fixtures (polygon, point, deforestation present and absent). If it isn't legible, raise the quality before considering a fallback to PNG.
- **[The worker diverges from main-thread output]** (i18n keys missing from the bundle, thresholds unset, relative URLs) → The worker refuses to render without config or bundles (the getters already throw). A check compares the extracted texts of a PDF rendered in the worker with one rendered on the main thread, for the same input in en and es.
- **[GDAL handles shared across threads]** → A lock per entry. Measure contention with the reference report. The per-thread fallback is ready.
- **[Memory]** → Bounded LRUs (satellite bytes ≤ ~75 MB, 16 VRTs). Blob URLs revoked in the web.
- **[Old web against new API]** → It works: the web reads a blob and `@react-pdf` sniffs the format. **[New web against old API]** → It also works (PNG). They deploy together anyway.

## Migration Plan

- **No data or configuration migration.** `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION` keeps its name and its value; it now counts farms.
- **Order.** API changes (D2–D4) and web changes (D1, D5–D7) are independent and can ship in separate PRs.
- **Rollback.** Revert the PR. There is no persisted state.

## Resolved Questions (2026-10-07)

- **The satellite TTL.** The project owner approved 10 minutes (D2).
- **Pre-rendering the complete download.** Yes, in the background once the preview is ready, so "Download" feels instant (D6).
- **The reference report for the measurements.** 50 farms × 3 maps from the regression fixtures, with the satellite background. It times the image fetch, the preview render and both downloads, and records the PDF size and the Google calls.
