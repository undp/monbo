## Context

Stage 3 is three steps today:
1. **`MapSelectionModal`.** "Continuar" on the stage 2 results, or stage 3 in the stepper while `isReportSelectionReady` is false, opens it. The modal asks for "Todos / Seleccionar" farms and the report's layers (`MultiSelectionStep`).
2. **`/report-generation`.** The old layout: padding 3, a `SearchBar`, `ReportResultsTable` (`LayerResultsTable farmColumns="full"` with checkboxes), and a fixed footer with "Generar reporte". With no farm, the footer opens `NoFarmsSelectedModal`. Otherwise it sends `report_requested` and pushes `/report-generation/preview`.
3. **`/report-generation/preview`.** `ReportProvider` renders the preview in a worker as soon as `selection.key` exists, then pre-renders the complete report. Its footer downloads:
   - a large report goes straight to the ZIP with `ZipProgress`;
   - one farm goes straight to the PDF;
   - several farms open `DownloadTypeSelectionModal` (combined / separated).

The choices live in `DataContext.reportGenerationParams` (`initialFarmSelection`, `selectedMaps`, `selectedFarms`, `downloadType`), which `useKeptState` keeps for the tab. They are reset by a new analysis, by `invalidateAnalysis`, by new farms on either upload page, and by `resetAnalysis`.

Stages 1 and 2 already use the flow's pieces: `FlowPage`, `FlowPageHead`, `FlowSection`, `flowTable`, `FLOW_COLORS`, `FLOW_RESULT_PILL` and the restyled `LayerCategoryPicker`.

Decisions agreed with the product owner:
- the farm icons take the worst result, with the per-layer findings in the tooltip;
- the download works without a preview, or with a stale one;
- generating needs one farm and one layer, with the button off otherwise;
- the polygon list has a search, a bounded height and virtualization;
- the "Formato" modal always opens, because it holds the GeoJSON.

## Goals / Non-Goals

**Goals:**
- One report page, as in the mockup: choices in the sidebar, the PDF on the right.
- No dialog between stage 2 and stage 3.
- A PDF renders only when the user asks for it.
- The download always matches the current choice, with or without a preview.
- The PDF content, the worker, the large-report ZIP job and the image requests stay as they are.

**Non-Goals:**
- The report's content (GC-7, `report-by-category`).
- A per-farm preview or pagination inside the preview.
- Keeping the rendered preview across a visit to another page. The worker and its blobs live as long as the page.
- A usage event for the GeoJSON.

## Decisions

### 1. One route, one provider

`/report-generation` becomes the whole stage, and the page wraps its content in `ReportProvider`. `/report-generation/preview` gets a permanent redirect (308) to `/report-generation` in `proxy.tsx`, which keeps the locale prefix, as the GC-13 stage 2 redirects do. Its page is removed.

Layout:
```
FlowPage
  FlowPageHead  "Etapa 3 de 3" · "Reporte" · "Elige los polígonos y las capas, y genera la vista previa."
  ┌ sidebar 360 px ───────────────┐ ┌ preview panel (flex 1) ────────────┐
  │ FlowSection "Polígonos"       │ │ empty state / spinner / iframe /   │
  │   search, Seleccionar todos,  │ │ error + Reintentar                 │
  │   virtual list (max height)   │ │ stale notice + "Actualizar vista   │
  │ FlowSection "Capas del        │ │ previa"; satellite / large notices │
  │   reporte" (picker, 1 column) │ │                                    │
  │ [Generar vista previa]        │ │                                    │
  │ [Descargar]                   │ │                                    │
  └───────────────────────────────┘ └────────────────────────────────────┘
```

- On `md` and up, the two columns sit side by side, and the preview panel is as tall as the viewport under the header.
- Below `md`, they stack, with the sidebar first.
- The old fixed `Footer` goes away. `DevEnvWarning` moves to the sidebar's foot.
- The page keeps `AnalysisOutdatedGuard` and `NavigateHomepageWhenEmptyData`.

Alternative: keep `/preview` as a second page with the preview. Rejected, because the mockup is one screen and the stale-preview rule needs the choices next to the PDF.

### 2. Defaults set once per analysis

`reportGenerationParams.initialFarmSelection` (a choice of the removed modal) is replaced by `seeded: boolean`.
- On mount, when `!seeded`, the page sets these and `seeded: true`:
  - `selectedFarms` to every visible farm (`useVisibleDataForAnalysisPage`);
  - `selectedMaps` to every analysed layer that is visible.
- Every reset site sets `seeded: false` together with the empty lists:
  - `invalidateAnalysis`;
  - the analysis effect on the layers page;
  - both upload pages' "new farms" branches;
  - `resetAnalysis`, through `initialReportGenerationParams`.

  The extra field isn't missed at those sites: a test covers each one.
- So an empty choice the user made is kept, and only a new analysis brings the defaults back.

Alternative: derive "seed" from empty lists. Rejected, because a user who unticks every farm and comes back would get them all ticked again.

`downloadType` stays as the modal's format choice. It defaults to `"combined"` when the modal opens with none.

### 3. The preview on request (`ReportProvider`)

`ReportProvider` keeps `selection` (the current choice, with its `key`) and adds a requested key:
- `requestPreview()` sets `requestedKey = selection.key` and bumps `attempt`. `retryPreview` becomes the same call.
- The preview effect runs only when `requestedKey !== null`, and renders the selection that `requestedKey` names. It can't render the current one, because that may have changed meanwhile. So the provider keeps the requested `Selection` object in a ref when the request is made (`requestedRef`).
- Exposed state:
  - `previewState`: `"idle" | "loading" | "ready" | "failed"`;
  - `isPreviewStale = preview !== null && preview.key !== selection?.key`;
  - `isPreviewCurrent = preview?.key === selection?.key`, or a render of the current key in flight, turns the button off ("al día").
- The complete pre-render stays as it is (`keyed(completeRef, requested.key, …)` after the preview).
- `getCompleteReport` keeps using `selection` (the current choice). `keyed` returns the pre-rendered promise when the keys match, and starts a render otherwise. So a stale or missing preview downloads the current choice.
- `isLarge`, `farmCount` and `satelliteLimit` stay derived from the current `selection`, because they describe what "Descargar" will produce. The large and satellite notices above the PDF use the previewed selection's values, which the provider exposes as `preview.isLarge` and `preview.farmCount`.
- The ZIP-job cancel on a key change stays: a job belongs to the choice it started with.

Alternative: a `previewEnabled` flag that, once set, keeps the auto-render. Rejected, because the product owner wants a stale preview to stay until it is asked for again.

### 4. Polygon list

`ReportFarmList` (new, `components/page/reportGeneration/`):
- **Search.** The `SearchBar` on `?search=`, as the stage 2 table and map list. It matches by ID or producer with the same fuzzy search (`useSearch`).
- **"Seleccionar todos".** A tri-state checkbox over the listed farms.
- **Rows.** A box with `maxHeight` and `overflow: auto`, with a fixed row height of 56 px. Above 100 rows only the rows in view are rendered (`@tanstack/react-virtual`, already a dependency), as the upload list does.
- **Selection state.** `Set<string>` of ids derived once from `selectedFarms`. A toggle writes through `setReportGenerationParams`, as `ReportResultsTable` does today.
- **Category icons.** `farmCategoryResults(farms, results, maps, categories)` lives in `utils/` and is memoized per `(results, ticked maps, categories)` as a `Map<farmId, FarmCategoryResult[]>`. Each entry holds the category, its worst class and each layer's value and class. The worst order is flagged > unknown > ok (`classifyFarmInCategory`).
  - The row writes each layer's finding with `layerResult`, as the stage 2 pill does: the percentage when flagged, the label otherwise. Texts are built only for the rows in view.
  - The icon is the category's icon in `FLOW_RESULT_PILL[class]` colours, inside a MUI `Tooltip`, with `aria-label` "{{category}}: {{result}}".
- **A11y.** The list is a `role="group"` labelled "Polígonos", and each row is a checkbox named "{{id}} {{producer}}". The icons sit outside the checkbox's label, with their own name (category, result and findings). Native checkboxes keep Tab order. 1000 rows virtualized are about 15 in the DOM, so Tab stops stay few.

### 5. Layers section

`LayerCategoryPicker` gets `columns?: 1 | 3` (default 3), and the report passes `1`.
- Its options are the analysed layers (`territorialAnalysisParams.selectedMaps` ∩ visible).
- Ticking writes `selectedMaps`.
- Category cards keep "N de M capas".

### 6. Actions and messages

- **"Generar vista previa"** (`contained`). Its label changes to "Actualizar vista previa" once a preview exists.
  - It is off when no farm is ticked, when no layer is ticked, or when the preview is up to date. A caption under it says which applies: "Elige al menos un polígono", "Elige al menos una capa" or "La vista previa está al día".
  - Pressing it sends `report_requested` with the ticked farms, then calls `requestPreview()`.
- **"Descargar"** (`outlined`). It is off for an empty choice, and while a ZIP job runs.
- **Stale notice.** A blue `FLOW_COLORS` band over the PDF: "La vista previa no refleja los últimos cambios", followed by "Actualizar vista previa".
- **Empty state.** A document icon, then "Genera la vista previa para revisar el reporte antes de descargarlo."

### 7. "Formato" modal

`DownloadFormatModal` replaces `DownloadTypeSelectionModal`. It reads `selectedFarms.length` and `isLarge`:

| Case | Body | Primary | Secondary |
|---|---|---|---|
| several, not large | radio cards "Un PDF con todo / Un archivo con todos los polígonos." and "Un PDF por polígono / Se descargan en un .zip." | "Descargar PDF" (combined or separated) | "Descargar GeoJSON" |
| one farm | the farm's ID, no cards | "Descargar PDF" | "Descargar GeoJSON" |
| large | one fixed card "Un PDF por polígono (.zip)" + `preview.largeReport` text | "Descargar ZIP (N PDFs)" | "Descargar GeoJSON" |

- The radio cards are a `role="radiogroup"` with a roving tabindex and arrow keys, like `SubsetBanner`.
- A large download closes the modal and shows `ZipProgress` as today. `useReportDownload` stays and is moved from the footer to the modal.
- **GeoJSON:** `generateGeoJsonFarmsDataWithLayerAnalysis(selectedFarms, results ∩ selectedMaps, selectedMaps, availableCategories, t, language)`, saved through `useGeoJsonDownload` as `report.geojson`.

### 8. Flow wiring

- `utils/flowStages.ts`: remove `isReportSelectionReady`, `ReportSelection` and the `reportModal` action.
- `FlowStepper`: drop `MapSelectionModal`, so stage 3 navigates.
- `territorialAnalysis/PageFooter`: `NextStageCard onContinue` pushes `/report-generation`.
- Removed:
  - `MapSelectionModal`;
  - `NoFarmsSelectedModal`;
  - the report `PageFooter` and the preview `PageFooter`;
  - `ReportGenerationPreviewPageContent` (its iframe and error UI move into the preview panel);
  - `ReportResultsTable`, and `LayerResultsTable`'s `farmColumns="full"` if nothing else uses it.

## Risks / Trade-offs

- **[The requested selection vs. the current one.]** Rendering the wrong one would preview a choice the user didn't ask for. → The request captures the `Selection`. The tests:
  - change the choice while the preview renders, and check that the shown PDF is the requested one, marked stale;
  - download in that state, and check that the current choice is saved.
- **[Download without a preview renders on click.]** A big non-large report takes some seconds. → The button shows its loading state, as the preview footer does today.
- **[`seeded` is missed at a reset site.]** The report would then open with an empty or stale choice. → `selectedMaps` outside the analysis are filtered out anyway, and the reset sites are listed in the tasks with a test each.
- **[Category icons for 1000 farms × N layers.]** → They are computed once per (results, ticked maps), not per row render. The responsiveness requirement covers it.
- **[Archive order.]** `analysis-flow-stages`, `report-generation` and `usage-tracking` are touched by open changes. → Archive after `progressive-flow-stages`, `territorial-analysis-by-category`, `territorial-analysis-routes`, `stage-one-unified-table`, `stage-two-flow-redesign`, `layer-analysis-contract` and `report-by-category`.

## Migration Plan

Web only, with no contract change. The kept-state shape of `reportGenerationParams` changes (`initialFarmSelection` becomes `seeded`). The state lives in the tab, so a refresh clears it and nothing old needs reading. Bookmarks of `/report-generation/preview` are redirected. The work is one PR to `feat/layer-manager`, and it reaches `dev` with the integration PR (#145).

## Open Questions

None.
