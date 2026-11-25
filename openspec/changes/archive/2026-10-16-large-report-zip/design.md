## Context

The report page (`ReportProvider`, `src/context/ReportContext.tsx`) works like this today:

```
selection ─► fetch ALL N×M images (Blobs, kept for the page's life)
          ─► worker: render the complete PDF, no links (preview)   ← N×M pages in memory
          ─► worker: render the complete PDF again, with links      ← N×M pages again
"Download" ─► complete: the pre-rendered blob │ ZIP: worker renders N one-farm PDFs
                                              │ with every image, then JSZip
```

Measured on `dev` with the synthetic uploads in `.context/scale` (the API answers images at ~60/s when they have no satellite background):

| Report | Farm pages | Result |
|---|---|---|
| 500 × 4 | ~2000 | Preview 80 s (images ~31 s, render ~50 s); complete 45 s, 51 MB; ZIP 89 s, 109 MB |
| 500 × 7 | ~3500 | Tab crashes during the render, with no JS error |
| 1000 × 4 | ~4000 | Tab crashes during the render; the 3988 images had downloaded fine |

What holds memory is the complete document: `@react-pdf` keeps the whole tree and layout until `toBlob()` returns, and it is built twice in a row. The per-farm ZIP already renders one small document at a time. It only crashes because the full preview runs first, and because every image Blob is held for all the farms.

Constraints:
- The PDF stays client-side; server-side rendering was ruled out earlier.
- The API runs as one replica with 1 CPU in `dev`.
- The satellite background is all or nothing, capped at 90 farms in `dev` and 210 by default, so large reports get the solid background. That limit is out of scope.

## Goals / Non-Goals

**Goals:**
- Reports of 1000 farms × 5 layers download as a ZIP without crashing the tab, with progress and a responsive page.
- Small reports (≤ 1000 farm pages) behave exactly as today.
- Selecting farms in the report table stays under 100 ms of main-thread work per click at 1000 farms.
- An upload with many errors shows a bounded number of notices.

**Non-Goals:**
- A single PDF for large reports, or merging PDFs.
- Streaming the ZIP to disk (the File System Access API isn't available in every browser).
- Changing the per-farm document (cover, explanation and layer pages repeat in each PDF, as today).
- The satellite limit, `/analize` performance, or the polygon validation tables and exports.

## Decisions

### D1. "Large" is counted in farm pages, with a constant threshold of 1000

`isLargeReport(selection)` counts the selected (farm, layer) pairs whose result isn't null, which is the number of farm pages the complete PDF would have, and compares it with `LARGE_REPORT_FARM_PAGES = 1000`. The constant lives in `src/config` and is shared by the provider, the footer and the preview.

- **Why pages, not farms.** The render cost follows the pages: 250 farms × 4 layers costs as much as 1000 × 1.
- **Why 1000.** About 2000 pages worked and about 3500 crashed on the measuring machine (Apple silicon, plenty of RAM). Half of the last working point leaves room for modest laptops.
- **Alternative: an environment variable.** Not needed yet; the constant is one line to change once real usage is known.

### D2. A large report's preview is the first farm's PDF

For a large report, `ReportProvider` fetches only the first selected farm's images and asks the worker for a `complete` render of `[firstFarm]` without links, so the result is that farm's PDF as it will appear in the ZIP. The preview page shows it with an info notice ("The download is a ZIP with 1000 PDFs, one per farm") above the iframe.

- **No pre-render.** `completeRef` is never filled for large reports.
- **Alternative: no preview at all.** That would hide what the user is about to get.
- **Alternative: cover plus the first N farms.** That would show a document that doesn't exist in the download.

### D3. The ZIP is an incremental job in the worker

The protocol (`reportPdfProtocol.ts`) gains a job alongside today's one-shot render. Each message has a `jobId`:

```
main ─ zipStart {jobId, locale, config, maps, total} ───────────────► worker: new JSZip (STORE)
main ─ zipAdd {jobId, farm, results (only this farm's), images} ───► worker: render one-farm PDF,
                                                                      zip.file(), revoke URLs,
     ◄─────────────────────────────────── progress {jobId, done} ──  post progress
main ─ zipFinish {jobId} ──────────────────────────────────────────► worker: generateAsync(blob)
     ◄────────────────────────────────────────── {jobId, blob} ─────
main ─ zipCancel {jobId} ──────────────────────────────────────────► worker: drop the zip
```

- **Pipeline on the main thread** (`ReportProvider`): it walks the farms in selection order.
  - **Fetching:** it fetches one farm's M images together (the API's in-flight dedup then makes one satellite call per farm), with a look-ahead window of 8 farms under the existing `pLimit(20)`.
  - **Sending:** it sends each farm to the worker in order as soon as its images arrive. At most 2 farms are in the worker at a time, so Blobs don't pile up in the worker when it renders slower than images arrive.
  - **Releasing:** each farm's Blobs are released once the worker acknowledges it with a progress message.
- **Per-farm results.** `zipAdd` carries only that farm's results (`farmResults` filtered to the farm). That keeps the structured-clone cost per message constant, and the one-farm document already uses nothing else.
- **ZIP compression: STORE.** The PDFs are already compressed (the JPEGs are DCT and the text is Flate). The ZIP Blob is built by JSZip from the per-farm PDF Blobs, which Chrome backs on disk when they're large.
- **Small reports keep `kind: "perFarm"`.** Nothing changes for them, because they fit.
- **Alternative: keep `perFarm` with every image (today).** Memory grows with N×M images, plus the full preview before it.
- **Alternative: zip on the main thread.** `generateAsync` on hundreds of MB would compete with the UI.

- **Two safeguards against a job that never ends** (found in task 5.2):
  - **Watchdog:** a farm whose PDF hasn't come back from the worker within 2 minutes fails the job with `ReportWorkerStalledError`, shown as the usual error, and the worker is replaced. One farm renders in well under a second.
  - **Request timeout:** each image request gives up after 60 s and counts as a transient failure (D4).

  The first satellite run stalled for good at farm 883 of 1000. Every image had been answered, nothing was logged, and the page stayed alive. Its cause wasn't reproduced:
  - with images of satellite size answered by the bench (107 KB each, no Google), 1000 × 5 completes (675 MB);
  - a second real satellite run was stopped while being diagnosed.

  Either way, a stall now ends in an error instead of a job that never finishes.
- **Worker churn (known, not changed).** `pdfkit` decodes every PNG with an alpha channel when it embeds it in a document, and `png-js` does that with fflate's asynchronous `unzlib`, which starts a new worker per call. The report's cover and logo PNGs all have alpha, so each per-farm PDF starts about 10 short-lived workers: about 10,000 for a 1000-farm ZIP. Measured, it costs time but not stability (every solid and satellite-sized run completes). Removing it would mean pre-compositing the cover and flattening the logo, which changes assets the report shares with small reports. Left for a follow-up.
  - `cache={false}` on the farm's map image (one use per PDF) keeps `@react-pdf`'s 30-image cache for the shared images. It was tried for the churn and kept because it is correct, but it doesn't remove the decoding: `pdfkit` decodes per document whatever the cache holds.

### D4. Image requests of a large report are retried

`fetchFarmImages(farm, maps, …)` (new, in `deforestationImages.ts`) fetches one farm's images. A request that fails with a network error or a 5xx is retried twice with a short backoff (0.5 s, then 2 s).
- **Not retried:** a 409 (`MapLayerChangedError`), which aborts the job and invalidates the analysis as today, and any other 4xx.
- **Why only here.** A job makes thousands of requests over minutes, and one transient failure shouldn't throw away the work. The small-report path keeps its current behaviour.

### D5. Cancellation

Each job has an `AbortController`.
- **What cancels it:** unmounting the page, changing the selection, or the user's "Cancel" while the ZIP is built.
- **What cancelling does:** it aborts the in-flight image requests (`fetch` gets the signal), stops the pipeline, sends `zipCancel` and releases the Blobs. Unmounting also terminates the worker, as today.

### D6. The footer for a large report

- **No modal.** "Download" doesn't open the download-type modal, since there is only one type. The button reads "Download ZIP (1000 PDFs)".
- **Progress.** While the job runs, a card centered on the page (`ZipProgress`) shows a ring with the percentage, "340 of 1000 farms", a hint that leaving the page cancels the download, and a "Cancel" button. It isn't a modal: back and other navigation stay available. The footer's button stays disabled meanwhile.
  - The first version put "Generating 340 of 1000" in the footer, but the footer is an `AppBar` that paints its text in the contrast color, so the text came out white on white. A centered card is also easier to notice for a job that takes minutes.
- **Small reports keep the modal.** If a selection becomes large while the modal is open, the "single PDF" option is disabled with the reason.
- **Strings:** en and es, in `reportGeneration`.

### D7. The selection table is indexed

In `reportGeneration/DeforestationResultsTable.tsx`:
- **Indexes:** `selectedIds = useMemo(new Set(...))` and `farmsById = useMemo(new Map(...))` replace the `.some`/`.find` calls in `isRowSelected` and the toggle.
- **Results lookup:** `parseRows` (`deforestationAnalysis/DeforestationResultsTable.tsx`) gets a `Map<mapId, Map<farmId, value>>` built once per results, instead of a `find` per cell. Its callers memoize the rows.
- **Search index:** the `useSearch` options become stable (memoized), so the Fuse index isn't rebuilt on every render.
- **Done when:** the bench (`.context/scale/interact.py`) records no long task over 100 ms on check, uncheck, check-all and uncheck-all at 1000 farms. If the `Table.tsx` re-render of all rows still exceeds the budget after that, memoizing the row component (`React.memo` with a stable `isRowSelected`) is the next step.
- **What it took (measured):**
  - **Indexes only were not enough.** `Table.tsx` re-rendered every row on each change, and on every `mouseenter` too (its hover state).
  - **Memoized rows.** Each row is a memoized component, and its data cells another one, so a selection change re-renders only checkboxes. The hover state stays (rows sharing `data`, as in the inconsistencies table, highlight together), but each row only gets a `hovered` boolean, and tables without `onRowClick` don't track it.
  - **Result in production (Docker build): one click 93 ms, check-all 108–113 ms**, against 296–429 ms before. Check-all still re-renders 1000 MUI `Checkbox`es, which a native input made about three times cheaper. Removing the ripple changed nothing.
  - **Selection updates as transitions.** The report table's handlers wrap the selection update in `startTransition`: React renders it in slices, and no long task is recorded on any click (development build: 0 ms, with the final state checked).
  - **Alternative: native checkboxes in the rows.** Cheaper, but they would change the look.

### D8. Upload errors

A helper `notifyUploadErrors(openSnackbar, errorMessages, t)`:
- shows the first 5 messages;
- when there are more, adds one notice with `common:snackbarAlerts:moreUploadErrors` ("And {{count}} more errors" / "Y {{count}} errores más").

Both upload pages use it instead of their loop.

## Risks / Trade-offs

- **[A ZIP of ~270 MB, estimated for 1000 × 5, held as a Blob]** → STORE compression and disk-backed Blobs. Task 5.2 measures it. If it fails on the measuring machine, the fallback is to split the download into ZIP parts of 250 farms each, written in the design before implementing it.
- **[Long jobs, 4–5 minutes estimated for 1000 × 5]** → Progress, cancel and retries. The page stays usable.
- **[The threshold depends on the device]** → It is conservative, and a one-line constant.
- **[The first farm's PDF isn't representative of every farm]** → The notice says what the download contains; the layout is the same for every farm.
- **[Each PDF in the ZIP repeats the cover and the layer pages]** → That is today's per-farm document; changing it is out of scope.
- **[Two code paths for the ZIP]** (small: `perFarm`; large: the job) → Small reports could move to the job later. Keeping them apart avoids changing what works.

## Migration Plan

No data or configuration changes. It ships with the next web deploy, and rollback is reverting the PR.

## Open Questions

- Should the threshold become an environment variable once there is usage data? (Not now.)
- **Should the satellite cap go up?** Today it is 90 farms in `dev` (Terraform default 210), and above it no image gets a satellite background. With the farm-by-farm ZIP, memory no longer limits it, and the cache makes one Google call per farm. What remains are:
  - the Google cost: about 1000 calls for a 1000-farm report;
  - the fetch time;
  - the ZIP size: images of ~107 KB instead of ~16 KB, so ~650 MB estimated for 1000 × 5.

  Task 5.2 measures 1000 × 5 with the satellite on, and its result decides whether to keep the cap, raise it, or raise it with lower-resolution images for large reports, in a separate change.

  **Measured (5.2):**
  - **Size:** a satellite 1000 × 5 ZIP is ~675 MB, held in the browser until saved. With images of that size it completes (207 s) on an 8 GB machine.
  - **Stalls:** two real runs stalled near the end while that machine swapped heavily.
  - **Recommendation:** keep the cap for large reports. Raising it needs lower-resolution images or a ZIP split into parts, in its own change.
