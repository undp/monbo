## 1. Baseline

- [x] 1.1 Record the baseline on `dev` and locally (5 Ecuador layers locally; in `dev`, republish one hidden test layer temporarily, and hide it again at the end):
  - with `.context/scale/scale_bench.py` (500 and 1000 farms, 4 and 5 layers): validation, analysis, preview, complete PDF and ZIP;
  - with `preview_diag.py`: crash or not, and the renderer's peak memory;
  - with `interact.py`: report-table clicks.

  Copy the `dev` numbers from the study and add the 5-layer runs.

  **`dev`** (production build, `8a85d40`, from the study):

  | Report | Result |
  |---|---|
  | 500 × 4 (1996 farm pages) | Analysis 11.2 s; preview 80.7 s (images ~31 s); complete 44.6 s, 51.2 MB; ZIP 89.4 s, 108.7 MB |
  | 500 × 7 (~3500) | Tab crashes during the preview render |
  | 1000 × 4 (3988) | Tab crashes during the preview render (the images had all arrived, ~60 s) |
  | 1000 × 7, before the report | Validation 5.2 s; analysis 27.7 s (`/analize` 21.8 s) |

  Report table at 1000 farms: 296–429 ms long task per checkbox click (one, all, none). Search: no long task.

  **Local** (`next dev`, so React's development build, slower than production; 5 Ecuador layers, the 5th being "teest"):
  - 500 × 5 (2495 farm pages): the tab crashes during the preview render, at a peak sampled RSS of 708 MB.
  - 1000 × 5: not run to the end, since it is a superset of the cases that already crash.
  - Report table at 1000 farms: 1089–1236 ms long task per click (one, all, none); hovering across rows 371 ms for 20 rows; search with no long task.

  `dev` with 5 layers needs a test layer republished there (admin passkey). It is left for 5.2, where it measures the change; 4 and 7 layers bracket it for the baseline.

## 2. Large report classification and preview

- [x] 2.1 `LARGE_REPORT_FARM_PAGES = 1000` in `src/config` and `isLargeReport(selection)`: counts the selected (farm, layer) pairs with a non-null result (D1). Unit tests (Vitest): 250 × 4 is not large, 300 × 4 with 60 nulls is large, and only selected layers count

  `src/config/constants.ts` (`LARGE_REPORT_FARM_PAGES`) and `src/utils/reportSize.ts` (`countFarmPages`, `isLargeReport`). 3 tests.
- [x] 2.2 `ReportProvider` (D2):
  - for a large report, the preview fetches only the first farm's images and renders `[firstFarm]` without links;
  - no pre-render (`completeRef` stays empty);
  - the context exposes `isLarge` and `farmCount`

  `ReportProvider` adds `farmPages` and `isLarge` to the selection.
  - **Preview of a large report:** `renderFirstFarm` previews the first selected farm that has a result, with only that farm's results.
  - **Context:** it exposes `isLarge`, `farmCount` and `buildLargeReportZip`.
  - **Complete PDF:** `getCompleteReport` rejects for a large report.
- [x] 2.3 Preview page: an info notice above the iframe for large reports ("The download is a ZIP with {{count}} PDFs, one per farm"), en and es

## 3. ZIP job

- [x] 3.1 Protocol and worker (D3):
  - messages `zipStart`, `zipAdd`, `zipFinish` and `zipCancel`, plus a `progress` response;
  - the worker keeps one JSZip per job (STORE), renders each farm's PDF with only that farm's results, and revokes its URLs after each farm;
  - `ReportPdfClient` gets `startZip()`, which returns a handle with `add`, `finish`, `cancel` and an `onProgress` callback

  The worker shares `renderDocument` and `withImageUrls` between the one-shot render and the job, and keeps its jobs in `zipJobs`. The client has `startZip()` → `{ add, finish, cancel }`. 5 new client tests; the worker itself is checked in the browser (5.2).
- [x] 3.2 `fetchFarmImages` in `deforestationImages.ts` (D4): one farm's images, with an `AbortSignal`, retrying network errors and 5xx twice (0.5 s, 2 s); a 409 throws `MapLayerChangedError`. Unit tests with a mocked `fetch`: retry then success, 409 not retried, abort

  `ImageRequestError` (status) and an `AbortSignal` in `generatePolygonDeforestationImage`; `includesSatelliteBackground` and `mapsWithResults` factored out for both paths. 6 tests.
- [x] 3.3 The pipeline in `ReportProvider` (D3, D5):
  - a look-ahead of 8 farms under `pLimit(20)`, at most 2 farms in the worker, Blobs released on each progress message;
  - `getLargeReportZip({ onProgress, signal })`;
  - cancel on unmount, on selection change and from the user;
  - `MapLayerChangedError` invalidates the analysis

  `runZipJob`: a look-ahead of 8 farms, at most 2 farms in the worker, and each farm's images dropped once handed over. `zipJobRef` aborts on unmount and on selection change. 5 new provider tests (16 in total).
- [x] 3.4 Footer and modal (D6):
  - for a large report, "Download ZIP ({{count}} PDFs)" downloads directly, without the modal;
  - progress shows a centered card (`ZipProgress`) with the percentage, "{{done}} of {{total}} farms" and a "Cancel" button;
  - in the modal, the "single PDF" option is disabled with its reason when the selection is large;
  - en and es


  The footer of a large report downloads the ZIP directly. The progress is a card centered on the page, `ZipProgress.tsx` (3 tests): a ring with the percentage, "62 de 500 fincas", a hint that leaving the page cancels it, and "Cancelar" (`common:cancel`). It replaced a first version in the footer whose text the `AppBar` painted white on white. Checked in the browser: the count advances, and cancelling removes the card in 1 s.
  - The modal never opens for a large report, so it needs no disabled option. A selection can't change while the preview page is open.
  - **First local run, 1000 × 5 (`next dev`):** preview 2.4 s with the notice; ZIP 180 s, 245.5 MB, 1000 PDFs, 4985 image requests, the renderer's peak at 409 MB, no long task, the longest frame gap 200 ms, and the progress shown throughout.
## 4. Selection table and upload errors

- [x] 4.1 Report selection table (D7):
  - `Set` of selected ids and `Map` of farms by id;
  - `parseRows` with a results index, and memoized rows;
  - stable `useSearch` options.

  Check with `interact.py` at 1000 farms that no click causes a long task over 100 ms. If it still does, memoize the table row (D7)

  **Changes:**
  - **Report table:** `Set` and `Map` lookups, plus `startTransition` on selection.
  - **Analysis table** (shared): a results index, memoized `headers` and `rows`, a constant `SEARCH_OPTIONS`, and the `every()` check moved out of the sort loop.
  - **`Table.tsx`:** memoized `BodyRow` and `RowCells`, with hover passed as a `hovered` boolean (D7).

  **`interact.py` at 1000 farms** (longest long task):

  | Click | Before (dev, prod build) | Before (local, dev build) | After (local, dev build) |
  |---|---|---|---|
  | Uncheck one | 429 ms | 1205 ms | 0 ms |
  | Check one | 296 ms | 1089 ms | 0 ms |
  | Uncheck all | 368 ms | 1147 ms | 0 ms |
  | Check all | 347 ms | 1236 ms | 0 ms |

  - **Checked:** the final state was verified (999, 1000, 0, 1000 checked).
  - **Production build before the transitions:** 93 ms for one click and 108–113 ms for all.
- [x] 4.2 `notifyUploadErrors` (D8):
  - at most 5 notices plus a summary (`common:snackbarAlerts:moreUploadErrors`, en and es);
  - used by both upload pages;
  - a unit test with 3 errors and with 1000

  `src/utils/uploadErrors.ts`, used by both upload pages; `SnackbarType` is now exported. 3 tests.
- [x] 4.3 Run `tsc`, lint, the web's unit tests and the build


  - **tsc:** clean.
  - **Lint:** 0 errors, the same 18 warnings as before.
  - **Unit tests:** 192 passing at this point, 29 more than before.
  - **Build:** `docker build -f Dockerfile.prod` passes.

  Re-run at the end (6.x).
## 5. Verification

- [x] 5.1 Small reports unchanged: with the 50-farm reference report and with 200 × 4, the preview, the complete PDF (pre-rendered) and the ZIP behave as before. Compare the PDF texts and links with the baseline

  - **Setup:** the 50-farm reference report × 4 layers, on the deployed `dev` (old code) and on this branch's production image (local API).
  - **Same behaviour:** preview 15.4 s / 15.2 s; the complete PDF, pre-rendered, saved 2.1 s / 2.2 s after the click; ZIP 11.1 s / 9.6 s; sizes 23.6 MB and 29.2 MB on both.
  - **Same content:** the complete PDF has 211 pages, 203 links, 405 images and the same fonts on both.
  - **The only text differences are data:** the `dev` share's layer names carry a "2.0" suffix (edited in its admin). Every differing line is one of those names.
  - **200 × 4 (800 farm pages) is still small:** no notice, preview 18.1 s, complete 3.3 s (20.6 MB), ZIP 33.2 s (43.5 MB).
- [x] 5.2 Large reports, locally and on `dev` after deploying the branch:
  - 500 × 4, 500 × 5, 1000 × 4 and 1000 × 5: the one-farm preview, then the ZIP. Record time, size, number of PDFs, the renderer's peak memory and the longest main-thread task. No tab crashes;
  - the PDFs inside the ZIP match the small-report per-farm PDFs for the same farms (text and links).

  If the 1000 × 5 ZIP fails because of its size, stop and update the design (ZIP parts, D3 risk) before going on

  **With the satellite background** (to decide the cap, which this change doesn't modify):
  - **Where:** 1000 × 5, run locally against the local API with `NEXT_PUBLIC_MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION=1000`. `dev` keeps its cap of 90; raising it there means a Terraform change and a deploy, which this measurement doesn't need.
  - **Cost:** about 1000 Google Static Maps calls per run (one per farm, thanks to the cache). Run it once.
  - **What to record:** the time to fetch the images, the ZIP time and size (estimated ~650 MB), the renderer's peak memory, and whether the tab survives.
  - **Outcome:** a recommendation for the cap (keep it, raise it, or raise it with lower-resolution images for large reports), recorded in the design's Open Questions

  **Production image of this branch, local API, solid background (`zip_bench.py`):**

  | Report | Preview | ZIP | Size | PDFs | Renderer peak | Longest long task |
  |---|---|---|---|---|---|---|
  | 500 × 4 | 1.0 s | 80.9 s | 108.4 MB | 500 | 325 MB | 55 ms |
  | 500 × 5 | 1.0 s | 86.5 s | 122.4 MB | 500 | 428 MB | 55 ms |
  | 1000 × 4 | 1.1 s | 158.7 s | 217.5 MB | 1000 | 510 MB | 0 ms |
  | 1000 × 5 | 1.0 s | 168.0 s | 245.5 MB | 1000 | 417 MB | 0 ms |

  No tab crashed. Before this change, 500 × 5 and 1000 × 4 crashed in the preview.

  **The ZIP's PDFs match the small-report ones.** F0001, F0150 and F0200 in the 1000 × 4 ZIP are identical to the same farms in the 200 × 4 (small-report) ZIP: 15 pages, 7 links, 13 images and the same text.

  **With the satellite background** (cap raised to 1000, real Google):
  - **Two real runs stalled near the end** (at 883 and at 940 of 1000), with every image answered and nothing logged.
  - **The second stall was this machine.** It has 8 GB of RAM, and the Docker VM alone held 5.2 GB, so it swapped heavily: every browser process dropped to 10–40 MB at once, and the page stopped running timers (not even the new watchdog fired).
  - **The same memory profile completes.** With satellite-sized images answered by the bench (107 KB each, no Google), 1000 × 5 completes: 206.9 s, **674.7 MB**, 1000 PDFs, renderer peak 425 MB.
  - **Recommendation: keep the cap.** A satellite ZIP of 1000 × 5 is ~675 MB, held in the browser's memory until it's saved, which is too much for modest machines. Raising the cap for large reports would need lower-resolution images, or a download split into ZIP parts. Recorded in the design's Open Questions.
  - **Google calls:** about 2300 across the runs (≈ 890 + 360 + 1000, minus cache hits).

  **Found and fixed while measuring** (D3):
  - a watchdog for a farm the worker doesn't return within 2 minutes;
  - a 60 s timeout per image request;
  - `cache={false}` on the farm's map image.

  The PNG worker churn (about 10 workers per farm, from `pdfkit` decoding alpha PNGs) is documented and left as it is: it costs time, not stability.

  **`dev`** needs this branch deployed, which `deploy.yml` does only from `dev`: see 5.6.
- [x] 5.3 Cancellation and retries: leaving the page mid-job stops the image requests. A forced 5xx on one image (route interception in the bench) is retried, and the ZIP completes

  - **Cancel** (1000 × 4, at 33 s and at 54 s): the image requests stop (836 → 836, 1464 → 1464), and "Descargar ZIP" is back in 1.0 s.
  - **A bug found and fixed on the way.** The first run left "Generando 218 de 1000" on screen: a farm still rendering when the user cancelled reported its progress after the footer had reset. Now the pipeline drops progress once the job is aborted, and the footer ignores progress from a job that isn't the current one. There is a test for it.
  - **Retries:** 3 forced 503s (route interception) are retried, and the 500 × 4 ZIP completes (500 PDFs, 108.4 MB).
  - **A hung request:** retried after its 60 s timeout (unit test).
- [x] 5.4 Report table and upload errors: the `interact.py` numbers before and after; an Excel with every row missing a column shows 5 notices plus the summary

  - **Report table, production image, at 1000 farms:** 0 ms long task on uncheck one, check one, uncheck all and check all, with the final state verified. Before (`dev`): 296–429 ms.
  - **Upload errors:** an Excel whose 1000 rows lack "Coordenadas finca" shows 6 notices in each module: the first 5 errors, then "Y 995 errores más en el archivo". Longest long task: 59 ms.
- [x] 5.5 Hide the test layer republished in `dev` for the measurements


  No test layer was republished in `dev`: the 5-layer runs were local. Nothing to hide.
- [ ] 5.6 After the merge (`deploy.yml` deploys `dev`):
  - on `dev`, 1000 × 4, and 1000 × 5 with one hidden test layer republished temporarily (admin passkey);
  - check the one-farm preview, the ZIP time and size, and that the tab doesn't crash;
  - hide the test layer again.

## 6. Close

- [x] 6.1 Docs:
  - `apps/web/README.md` "PDF report": large reports, the threshold and the ZIP job;
  - `docs/architecture.md` if it describes the report flow;
  - CHANGELOG

  - **`apps/web/README.md`, "PDF report":** large reports, the threshold, the ZIP job and its timing.
  - **`docs/architecture.md`:** a large report's image requests.
  - **CHANGELOG:** 3 Changed entries.
- [x] 6.2 Record the before and after table in this file

  **Before and after**, on the production build, with solid background:

  | | Before (`dev`, `8a85d40`) | After (branch, production image) |
  |---|---|---|
  | 500 × 4: download | complete PDF 44.6 s (51.2 MB) or ZIP 89.4 s (108.7 MB) | ZIP only, 80.9 s (108.4 MB) |
  | 500 × 4: preview | 80.7 s | 1.0 s (one farm) |
  | 500 × 5, 1000 × 4, 1000 × 5 | the tab crashes, nothing can be downloaded | ZIP: 86.5 s / 158.7 s / 168.0 s, at most 510 MB renderer peak |
  | Report table click at 1000 farms | 296–429 ms long task | 0 ms |
  | Upload with 1000 invalid rows | 1000 notices | 6 notices |

  Small reports (≤ 1000 farm pages) are unchanged (5.1).
