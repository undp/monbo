## Why

Users upload 500 to 1000 farms, and the report can't take it. Measured against the deployed `dev` (`8a85d40`) with synthetic uploads of 500 and 1000 Ecuadorian farms:

- **Everything before the report holds up.**
  - Polygon validation: 4.7 s at 500 farms, 5.2 s at 1000.
  - Deforestation analysis: 27.7 s at 1000 farms × 7 layers (`/analize` 21.8 s, far from Azure's 240 s cutoff).
  - The map, the search and the result tables load without freezing the page.
- **The report breaks.** The preview renders the whole PDF (farms × layers pages) in the worker, then renders it again with links for the download, while it holds every image Blob.
  - **500 farms × 4 layers (~2000 pages) works:** preview 80 s, complete PDF 45 s (51 MB), ZIP 89 s (109 MB).
  - **500 × 7 (~3500 pages) and 1000 × 4 (~4000 pages) crash the tab**, out of memory and with no JavaScript error. The images download fine (~60 per second); the tab dies while the PDF renders.
  - **Nothing can be downloaded then.** The download buttons are on the preview page, so neither the complete PDF nor the ZIP is reachable.
- **Two smaller problems show up at 1000 farms:**
  - Checking a farm in the report table freezes the page for 300–430 ms per click, because of O(n²) lookups.
  - An Excel with an error on every row opens one notice per row, which can mean 1000 at once.

The product decision is that a large report is not one PDF: it is a ZIP with one PDF per farm. It has to work with at least 5 layers.

## What Changes

- **Large reports.** A report is large when its farm pages (selected farms × selected layers with a result) exceed **1000**.
  - **Small reports keep today's behaviour:** full preview, complete PDF (pre-rendered) or ZIP.
- **A large report is delivered only as a ZIP with one PDF per farm.**
  - The single-PDF option isn't offered, and the page says why.
  - The ZIP is built **farm by farm**: fetch that farm's images, render its PDF in the worker, add it to the ZIP and release the images. Memory no longer grows with the number of farms.
  - A card centered on the page shows the progress as a percentage and as "340 of 1000 farms", with a "Cancel" button, and the page stays usable meanwhile.
  - Leaving the page or changing the selection cancels the job.
  - A transient failure of one image is retried before the whole job fails.
- **A large report's preview is a single farm.**
  - It shows the first selected farm's PDF, exactly as it will appear in the ZIP, with a notice that the download is one PDF per farm.
  - There is no full preview and no pre-render of a complete report.
- **The report selection table stays responsive at 1000 farms.** Selection and result lookups are indexed by farm id, and the rows and the search index are memoized.
- **Upload errors are summarized.** An upload with many invalid rows shows the first few errors and one notice with the total, instead of one notice per row.

Out of scope:
- generating the PDF on the server;
- the satellite background's all-or-nothing limit;
- the remaining O(n²) spots in the polygon validation tables and the exports (measured fine at 1000);
- `/analize` performance.

## Capabilities

### New Capabilities

- `farm-upload`: how the web reports the errors of an uploaded farms file: a bounded number of notices, with a summary of the rest.

### Modified Capabilities

- `report-generation`:
  - large reports are a ZIP built farm by farm, with a one-farm preview and progress;
  - the images are fetched once per selection only for small reports;
  - the complete report is pre-rendered only for small reports;
  - selecting farms stays responsive at 1000 farms.

## Impact

- **Web, report:**
  - `src/context/ReportContext.tsx`: classifies the report; one-farm preview; ZIP job with progress and cancellation; no pre-render for large reports;
  - `src/workers/reportPdf.worker.tsx`, `reportPdfClient.ts` and `reportPdfProtocol.ts`: an incremental ZIP job (start, add a farm, finish) with progress messages;
  - `src/utils/deforestationImages.ts`: fetching one farm's images, with a retry;
  - `src/components/page/reportGeneration/preview/*`: the footer, the download modal and the preview notice;
  - the locales (`reportGeneration`, en and es).
- **Web, selection table:** `src/components/page/reportGeneration/DeforestationResultsTable.tsx`, `src/components/page/deforestationAnalysis/DeforestationResultsTable.tsx` (`parseRows`) and `src/hooks/useSearch.tsx` callers.
- **Web, upload:**
  - `PolygonsValidationUploadDataPageContent.tsx` and `DeforestationAnalysisUploadDataPageContent.tsx`, possibly with a shared helper;
  - the locales (`common`).
- **API:** none.
- **Verification assets** (gitignored): `.context/scale/`, with the 500 and 1000-farm Excels and their generator, and the browser benches.
