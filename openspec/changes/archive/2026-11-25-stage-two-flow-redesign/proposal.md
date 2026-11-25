## Why

Stage 2 still puts everything on one page. On `/territorial-analysis/upload-data` the user picks layers and uploads polygons, and an upload starts the analysis at once. A user who comes in directly sees a warning instead of stage 1's upload, and the subset of polygons is chosen with radio buttons in a plain alert. The results page keeps the layout from before the redesign. The v2 mockup splits stage 2 into three steps: upload, layers and results. Each step uses stage 1's components: the stage head, sections, tables, the bottom bar and the next-stage card.

## What Changes

- **Direct entry uploads first.** Without farms, stage 2 opens on `/territorial-analysis/upload-data`. It uses stage 1's upload: method cards, the list of farms and a bottom bar, whose button reads "Continuar". "Continuar" parses the list and goes to the layers. **BREAKING (behavior):** uploading no longer starts the analysis. Only "Analizar" does (updates D22 → D25).
- **A layers page.** `/territorial-analysis/layers` is new.
  - It shows a banner with the polygons the analysis will use and a "Ver polígonos" link.
  - It shows the layers by category, styled as the mockup.
  - A bottom bar reads "N polígonos · N capas en N categorías" and has "Analizar".
  - After a validation, the banner lets the user choose between the valid polygons and all of them. Without a validation it only informs.
  - "Ver polígonos" goes to the validation results after a validation, and to the upload list otherwise.
  - Without farms, the page sends the user to the upload.
- **One upload list for the flow.** Stage 1's kept list becomes the flow's list (`uploadSources`), and both stages edit it.
  - Stage 1 no longer validates on entry the farms uploaded on stage 2. It shows their list with its button.
  - "Agregar más polígonos" is offered whenever the list exists.
  - Changing the list and pressing "Continuar" or "Validar" drops the results that no longer describe the farms.
- **Results page as the mockup.**
  - The head reads "Resultados del análisis territorial", with "Cambiar capas" and the download (Excel and GeoJSON) at its right.
  - The category cards and the "Resultado por polígono y capa" section use stage 1's table style.
  - The section header holds the search and "Ver en el mapa" / "Ver tabla". The farm columns are ID and Productor.
  - The next-stage card still opens the report layer modal.
- **Routes.** The stepper, "Cambiar capas", stage 1's next-stage card and `AnalysisOutdatedGuard` point to the right page of the three.

Out of scope: a GLOBAL / NACIONAL tag on each layer. The API has no such field. It is a follow-up for the admin (GC-5).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `analysis-flow-stages`: stage 2 has three pages (upload, layers, results), where stage 2 leads in the stepper, and uploading on stage 2 no longer drops the validation by itself.
- `territorial-analysis`: direct entry uploads first, the layers page and its banner, the analysis starts only from "Analizar", and the results page and table follow the mockup.
- `farm-upload`: the kept upload list belongs to the flow, not to stage 1, and "Continuar" keeps the farms when the list didn't change.
- `validation-results`: "Agregar más polígonos" is offered whenever the flow's list exists, and stage 1 no longer validates on entry.

## Impact

- Web only, under `apps/web/src`. The API and the contract don't change.
- Pages: `app/[locale]/territorial-analysis/{page,upload-data/page}.tsx` and a new `layers/page.tsx`.
- Components:
  - `TerritorialAnalysisUploadDataPageContent` is split into an upload page and a layers page.
  - Restyled: `LayerCategoryPicker`, `CategorySummaryCards`, `LayerResultsTable`, `DownloadPageData`, `ChangeLayersButton` and `PageTitle`.
  - Stage 1's `PolygonsValidationUploadDataPageContent` and `ValidationResultsTable` change for the shared list.
- State: `DataContext` renames `stageOneUploadSources` to `uploadSources`, and `useUploadSources` keeps the list for both stages. `utils/flowStages.ts` changes the stage 2 target.
- Locales: `territorialAnalysis.json` and `common.json`, in `es` and `en`.
- Docs: `content/documentation/{es,en}/` (stage 2) and `docs/onboarding.md` if it describes the stage 2 flow.
- The report stage reuses `LayerResultsTable` (`ReportResultsTable`). It keeps its farm columns.
