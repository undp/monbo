## 1. Baseline

- [x] 1.1 Record the baseline for the reference report (50 farms × 3 maps from the regression fixtures, with the satellite background):
  - time to fetch the images;
  - time to render the preview;
  - time to download the complete report;
  - time to download the separated-reports ZIP;
  - size of the complete PDF;
  - number of Google Static Maps calls (from the API logs).

  Save the numbers in this file.

  **Reference.** The fixture has only 10 farms (5 with results on the 3 maps), so the reference is derived from it: F01, F02, F03 and F08 shifted on a ~2 km grid (40 polygons), plus 10 points, all in the Ecuadorian Amazon, against maps 0 (GFW), 1 (TMF) and 2 (MAATE 2020-2022). The scripts are in `.context/bench/` (gitignored): `make_reference.py`, `api_bench.py` and `web_bench.py` (Playwright over the real flow).

  **API** (`api_bench.py`). In-process with the lifespan, one event loop, 150 images, 20 concurrent, map-major order as in the web today:

  | Run | Time | Google calls | Image | Total | `/health/live` max |
  |---|---|---|---|---|---|
  | 1 | 10.65 s | 150 | 505 KB PNG | 74 MB | 16 ms |
  | 2 | 9.57 s | 150 | | | 11 ms |
  | 3 | 9.50 s | 150 | | | 9 ms |

  The event loop barely blocks (liveness ≤ 16 ms). The cost is in Google and in the image size.

  **Web** (`web_bench.py`, `next dev`, satellite on). `.env.development` caps it at 90, and 150 pairs would turn it off, so the cap was raised for this measurement.

  | Phase | Time | `/generate-image` | Image fetch | Longest freeze | Total long tasks | PDF / ZIP |
  |---|---|---|---|---|---|---|
  | Preview | 71.5 s | 300 (*) | 51.5 s | 1.86 s | 6.6 s | — |
  | Complete download | 60.0 s | 150 | 26.4 s | 1.34 s | 9.3 s | 42.4 MB |
  | Separated download | 45.4 s | 150 | 26.3 s | 1.81 s | 11.8 s | 42.4 MB |

  **Superseded.** The download rows here measured the preview's PDF, not the download; the valid times are in 6.1.

  (*) In dev, React StrictMode runs the preview's effect twice. Third-party requests: `fonts.gstatic.com`.

  - **Without satellite** (`.env.development` as is): preview 21.0 s, complete 12.0 s (2.0 MB), separated 6.9 s.
  - **Production build.** The local production build (`node .next/standalone/server.js` and `next start`) answers every route with a 307 to itself (next-i18n-router sets both `x-middleware-rewrite` and `location`), so it was measured with `next dev`. This needs checking outside this change.

## 2. API: image generation

- [x] 2.1 Shared `httpx.AsyncClient`:
  - created and closed in `lifespan` (`app/main.py`), with a timeout and connection limits;
  - an accessor in `GoogleMapsAPIHelper`, with a lazy fallback for code that doesn't run the lifespan (D4)
- [x] 2.2 Satellite cache in `GoogleMapsAPIHelper` (D2):
  - key `(center rounded to 7 decimals, zoom, size, map_type)`;
  - the value is a task that resolves to the bytes;
  - in-flight dedup;
  - failures are evicted;
  - LRU of 256 entries and a 10-minute TTL;
  - each caller decodes its own `Image`

  - Generic cache in `AsyncTTLCache.py`: a done callback settles each entry, so a cancelled caller doesn't drop the fetch; the clock is injectable.
  - The fetch checks that the bytes decode (`verify()`), so a bad response isn't cached.
- [x] 2.3 Raster cache (D4):
  - LRU of 16 `(src, WarpedVRT)` entries keyed by path, each with a `threading.Lock` around `vrt.read`;
  - eviction closes the handles;
  - `RasterManipulationHelper` uses it instead of opening `RasterDataContext` on every request

  - `RasterDatasetCache.py`. A raster evicted while waiting for its lock is reopened.
  - The lifespan closes the cache on shutdown.
  - The analysis (`deforestation_analysis/helpers.py`) still uses `RasterDataContext`: out of scope.
- [x] 2.4 Move the overlay, the compositing and the encoding to the threadpool in `MapImageGenerator.generate` and in the `/generate-image` router (D4)
- [x] 2.5 `/generate-image` returns JPEG: RGB, `quality=85`, `subsampling=0`, `media_type="image/jpeg"`. The tile endpoint keeps PNG (D3)
- [x] 2.6 Tests:
  - the cache makes 1 Google call for 3 concurrent and 3 sequential requests for the same geometry;
  - a failed fetch is retried on the next request;
  - LRU eviction and TTL;
  - the raster cache reuses the dataset and closes it on eviction;
  - `test_generate_image_checks_the_analysed_version` expects `image/jpeg` and a 500×500 body;
  - a request to `/health/live` is answered while a slow image generation is in flight.

  Run pytest, ruff, black and mypy

  - **Result:** 294 passed (12 new: `test_async_ttl_cache.py`, `test_raster_dataset_cache.py`, two in `test_google_maps_api_helper.py`, and the liveness test in `test_router.py`). Ruff, black and mypy are clean.
  - **The liveness test detects the problem.** With the overlay back on the event loop it fails (a ping waits the 0.5 s of the overlay); with threads it passes.
- [x] 2.7 Visual check of the JPEG on the regression fixtures (polygon, point, with and without deforestation, with and without the satellite background). Save the samples in `.context/` and note the verdict here

  - **Samples.** `.context/bench/jpeg-check.png` (polygons and a point, without deforestation) and `.context/bench/jpeg-check-deforestation.png` (R17 and R47, with deforestation, with satellite and with a solid background). Each shows the PNG, the JPEG and 3× crops of both.
  - **Verdict: OK.** At 3× the outline and the edges of the red pixels are identical, with no visible halos.

  **API measurement** (`api_bench.py`, same 150 images):

  | Order | Time | Google calls | Image | Total | `/health/live` max |
  |---|---|---|---|---|---|
  | Before | 9.5–10.7 s | 150 | 505 KB PNG | 74 MB | 9–16 ms |
  | map-major (the web today) | 2.48 s | 50 | 106 KB JPEG | 15.6 MB | 6 ms |
  | farm-major | 5.24–5.43 s | 50 | 106 KB JPEG | 15.6 MB | 4–5 ms |

  **The farm-major order (D2) is slower, so it is not adopted.** Only ~7 Google calls run in parallel instead of 20. Map-major gets every cache hit while the report has ≤ 256 farms, and the satellite limit (100 in production) keeps it below that. See D2 in `design.md`.

## 3. Web: images fetched once

- [x] 3.1 `fetchDeforestationImages`:
  - keep the map-major order (D2, measured in 2.7);
  - count distinct farms for the satellite limit (D5);
  - return the `Blob` along with its URL

  - It returns the `Blob`s only: on the main thread nobody needs a URL (the worker creates them, D6).
- [x] 3.2 `ReportImagesProvider` on the preview page (D1):
  - selection key;
  - fetch on key change;
  - revoke the old URLs on change and on unmount;
  - `MapLayerChangedError` → `invalidateAnalysis()`

  - Implemented as `ReportProvider` (`src/context/ReportContext.tsx`), which also owns the renders (D1, D6).
  - The images stay `Blob`s, so there are no image URLs to revoke on the main thread.
  - The preview's URL is revoked when replaced and on unmount.
- [x] 3.3 `useDeforestationCompleteReportDocument` and `useDeforestationReportDownload` read from the provider; no other caller of `fetchDeforestationImages` remains. Remove the `// TODO: improve the performance of fetching the images` comments

  - `useDeforestationCompleteReportDocument` was removed.
  - `useDeforestationReportDownload` keeps its API and its snackbars.
- [x] 3.4 Check in the browser's network tab that, after the preview, downloading the complete report and then the separated reports makes no request to `/generate-image`

  - Checked by `web_bench.py`, which counts `/generate-image` per phase: preview 150, complete download 0, separated download 0.
  - Before: preview 300 (in dev), complete 150, separated 450.

## 4. Web: local assets

- [x] 4.1 Add Roboto 400, 500 and 700 to `public/fonts/roboto/`, with the license file. Check the dynamic `fontWeight` in `sections.tsx` before dropping the other weights. Register them from local URLs in `deforestationReport.tsx` (D7)

  - `public/fonts/roboto/` holds Roboto-Regular, Roboto-Medium and Roboto-Bold (the same v2.137 files that were downloaded from gstatic) plus `OFL.txt`.
  - The dynamic weight in `sections.tsx` is `"bold"`/`"normal"` (700/400).
- [x] 4.2 Quantize `deforestationReportCoverBackgroundLeaf.png` (goal: ≤ 60 KB, alpha kept). Compare the cover before and after

  - 211 KB → 32 KB: PIL FASTOCTREE, 256-colour palette with alpha.
  - Mean difference: 2.5 levels out of 255.
  - Comparison over light and dark backgrounds: `.context/bench/leaf-check.png`. No visible change.
- [x] 4.3 Make the report's static image and font URLs absolute, from an `origin` parameter (D7)

  - `assetUrl()` (`src/utils/deforestationReport/assets.ts`) builds them from `globalThis.location.origin`, valid in the window and in the worker. No `origin` parameter is needed.

## 5. Web: render in a Web Worker

- [x] 5.1 `src/workers/reportPdf.worker.ts` and a promise-based client `renderReportPdf(request) → Blob` (D6). The worker sets up i18next with the bundles it receives, calls `setRuntimeConfig`, registers the fonts, creates and revokes its own object URLs, and renders `complete` or `perFarm` (+ JSZip)

  - `src/workers/reportPdf.worker.tsx`, `reportPdfClient.ts` (`ReportPdfClient.render`) and `reportPdfProtocol.ts`.
  - i18n: the worker runs the same `initTranslations` as the pages, whose JSONs are already bundled, so no bundles are sent (D6).
- [x] 5.2 Worker lifecycle on the preview page: created lazily, reused, terminated on unmount. Errors from the worker reach the existing snackbars

  - The worker is terminated on unmount, and the renders in progress are dropped (React's dev double mount restarts them).
  - Preview errors get a new snackbar (`errorGeneratingReportPreview`, en and es); before, they were unhandled.
- [x] 5.3 Preview: replace `<PDFViewer>` with an iframe over the blob the worker returns (`showLinks=false`, no toolbar). Revoke its URL when the blob is replaced and on unmount
- [x] 5.4 Pre-render the complete report with links in the worker once the preview is ready (D6):
  - "Download" saves that blob;
  - a click before it finishes awaits the same render;
  - a change of selection discards it, and a stale result is ignored;
  - check that after the preview, "Download complete" saves with no new render (no render message to the worker after the click)

  - Measured: after the preview, "Download complete" saves in 0.06–0.14 s, with 0 requests and no render.
- [x] 5.5 Separated download (ZIP) through the worker, on click, with the provider's blobs, no fetching.

  - Checked that the file is a ZIP with 50 PDFs.
- [x] 5.6 Check that the worker matches the main thread: extract the texts of a PDF rendered in the worker and of one rendered on the main thread, for the same input, in `es` and `en`. They must match

  - The same reference report and the same API, original version (main thread, a worktree of `208b7b8`) against the new one (worker), in `es` and `en`.
  - Both languages: 159 pages, the same text on every page, 153 links each, the same fonts (Roboto Regular/Medium/Bold) and 305 images each.
  - Visual check of the cover and a farm page: `.context/bench/pages-compare.png`.
- [x] 5.7 Check that the UI doesn't freeze: during the preview of the reference report the spinner animates and "back" works. No requests to `fonts.gstatic.com` or any other third-party host

  - **Freezes during the preview:** the longest long task drops from 2.7 s to 0 ms, and the longest frame gap from 2.8 s to 67 ms.
  - **Navigation:** clicking the header 3 s into the render navigates in 0.46 s.
  - **Third-party hosts:** none (before: `fonts.gstatic.com`).
- [x] 5.8 Check the worker after `entrypoint.sh` in the production image (`docker build` + run): `DOWNLOAD_GEOJSON_URL` and the API URL are substituted in the worker's chunk. Run tsc, lint and build

  - **Build.** `docker build -f Dockerfile.prod` builds; `pnpm run build` passes inside it. Turbopack bundles the worker (`static/chunks/turbopack-worker-*.js`, which loads 6 chunks). tsc is clean; lint has 0 errors and 18 warnings, all pre-existing (19 before: the deleted hook had one).
  - **Substitution.** With the container running, the env module the worker reads (`DOWNLOAD_GEOJSON_URL`, in `2i8gj_….js`, one of its chunks) carries the substituted URL, and no `__NEXT_PUBLIC_*__` placeholder is left in `/app/.next/static`.
  - **Side effect.** Turbopack also copies the worker's source to `static/media/reportPdf.worker.*.tsx`. It isn't loaded and contains nothing secret (it is the repo's code).
  - **Production build works.** The 307 loop seen in 1.1 with the local build doesn't happen in the image (`/` answers 200), so it was specific to running `node .next/standalone/server.js` locally. The production measurements in 6.1 use this image.

## 6. Close

- [x] 6.1 Re-measure the reference report (1.1), including the time from clicking "Download complete" until the save, and record the before and after numbers here

  **Production.** `Dockerfile.prod` images of the original version (`208b7b8`, against its own API) and the new one. Same reference report, satellite on, API cache cold (the API is restarted before each run), `web_bench.py`.

  | Phase | Before | After |
  |---|---|---|
  | Preview | 34.3 s | **8.7 s** |
  | "Download complete" (click → file) | 43.7 s | **0.04 s** (pre-rendered) |
  | "Download separated" (ZIP of 50) | 395 s | **7.5 s** |
  | `/generate-image` requests (preview / complete / ZIP) | 150 / 150 / 300 | 150 / 0 / 0 |
  | Google Static Maps calls for the whole flow | 600 | **50** |
  | Longest main-thread freeze (preview / complete / ZIP) | 0.52 / 1.27 / 1.69 s | 0 / 0 / 0 ms |
  | Total main-thread long tasks (ZIP) | 71.6 s | 0 s |
  | Complete PDF / ZIP | 42.4 / 51.4 MB | 17.1 / 22.4 MB |
  | Third-party hosts | `fonts.gstatic.com` | none |

  **Dev (`next dev`, both versions).** Preview 81.7 → 10.0 s, complete 53.6 → 0.06 s, separated 614 → 7.7 s, longest freeze 2.8 s → 56 ms.

  **API alone** (`api_bench.py`, 150 images). 9.5–10.7 s → 2.5 s, 150 → 50 Google calls, 505 KB → 106 KB per image.

  **Content.** Checked in 5.6: the same pages, texts and links in `es` and `en`, and the farm PDFs inside the ZIP (R01, R47) match too.

  **Two baseline corrections, found while measuring:**
  - Headless Chrome turns the PDF shown in the old `<PDFViewer>` into a download event, and the first baseline (1.1) captured those files instead of the downloads. The 1.1 download times are therefore not valid; the ones in this table are, because the bench now filters by filename and checks that the file is a PDF or a ZIP.
  - In the original version the preview re-rendered several times on its own (at 84, 96, 160 and 207 s in dev), and the separated download fetched its images again (300–450 requests). That explains the 395–614 s.
- [x] 6.2 Docs:
  - `apps/web/README.md` and `.env.template`: the satellite limit now counts farms;
  - `docs/architecture.md`: report flow (worker, image store, JPEG, satellite cache)

  - **`apps/web/README.md`:** the satellite limit variable (counts farms) and a "PDF report" section (provider, worker, pre-render, local assets).
  - **`docs/architecture.md`:** "Report images" now covers JPEG, the satellite and raster caches and the threads, and links to the frontend.
  - **`apps/api/README.md`:** the image is JPEG.
  - **`.env.template`:** unchanged, since it doesn't comment any variable.
