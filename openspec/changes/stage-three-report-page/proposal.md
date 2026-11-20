## Why

Stage 3 is the last one still built the old way. "Continuar" on the stage 2 results, and the stepper, open a modal that asks for "all or select" farms and the report's layers. The modal leads to a full-width table with checkboxes and a fixed "Generar reporte" footer, which opens a second page that renders the PDF straight away. The v2 mockup puts the report on one page: the choices on the left, the PDF preview on the right. The product owner also asked for these changes:
- the layers are chosen on the page, in the new style;
- every polygon starts selected, and a "Seleccionar todos" control is added;
- each polygon row summarises its results across the layers;
- the preview is rendered only when the user asks for it;
- the download opens a "Formato" modal that also offers the GeoJSON.

This change is part of the layer-manager project (undp/monbo#116, GC-10).

## What Changes

- **One report page.** `/report-generation` is the whole stage, laid out like the mockup:
  - **Left sidebar, "Polígonos" section:**
    - search;
    - "Seleccionar todos", ticked by default;
    - one row per polygon with a checkbox, its ID and producer, and an icon per category, coloured by the category's worst result. The tooltip gives each layer's finding.
    - The list has a maximum height and scrolls inside; its rows are virtualized.
  - **Left sidebar, "Capas del reporte" section:** `LayerCategoryPicker` in one column, with the analysed layers only, all ticked by default.
  - **Below the sections:** "Generar vista previa" and "Descargar".
  - **Right panel:** an empty state until the preview is generated, then the PDF.
  - `/report-generation/preview` redirects to `/report-generation`.
- **Preview on request.** The PDF preview renders only when the user presses "Generar vista previa".
  - A change to the farms or layers after that marks the preview as out of date, with a notice and "Actualizar vista previa". The PDF is not rendered again on its own.
  - At least one polygon and one layer are needed. Without them the button is off and says what is missing.
  - The "Elige al menos un polígono" modal is removed.
- **Download from the current choice.** "Descargar" works with or without a preview, and with a stale one. It always uses the current choice, and opens a "Formato" modal:
  - **Several polygons:** the radio cards "Un PDF con todo" and "Un PDF por polígono (.zip)", plus "Descargar PDF" and "Descargar GeoJSON".
  - **One polygon:** no format choice. It offers "Descargar PDF" and "Descargar GeoJSON".
  - **A large report:** only the ZIP option, with the reason, plus "Descargar GeoJSON". The ZIP is built farm by farm with its progress, as today.
  - The GeoJSON holds the chosen polygons with the chosen layers' results.
- **No report modal in the flow.** "Continuar" on the stage 2 results and stage 3 in the stepper go straight to `/report-generation`. **BREAKING (internal):** `MapSelectionModal`, `isReportSelectionReady` and the stepper's `reportModal` action are removed. The `initialFarmSelection` report choice is replaced by a flag. The flag records that the page already set its defaults for the current analysis.
- **Usage event.** `report_requested` is sent when the user presses "Generar vista previa", in place of the "Generar reporte" click. The event's contract doesn't change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `analysis-flow-stages`:
  - stage 3 is one route;
  - the stepper and the stage 2 next-stage card go to it without a modal.
- `report-generation`:
  - the report page holds the farm and layer choice, starting with everything;
  - polygon rows summarise their results by category;
  - the preview is rendered on request and can go stale;
  - the complete report is pre-rendered only after a requested preview;
  - the download modal offers the format and the GeoJSON;
  - selecting farms stays responsive in the new list.
- `usage-tracking`: `report_requested` is sent on "Generar vista previa".

## Impact

- **Web only** (`apps/web/src`), with no API or contract change:
  - `app/[locale]/report-generation/page.tsx` and `preview/page.tsx`;
  - `components/page/reportGeneration/` (new sidebar, polygon list, preview panel and download modal; `PageFooter`, `NoFarmsSelectedModal`, `ReportResultsTable` and the preview page content removed or replaced);
  - `context/ReportContext.tsx` (the preview on request);
  - `context/DataContext.tsx` (the report choices' flag);
  - `hooks/useReportDownload.tsx`;
  - `utils/flowStages.ts`, `components/page/flow/FlowStepper.tsx`, `components/page/territorialAnalysis/PageFooter.tsx` and `MapSelectionModal.tsx` (removed);
  - `LayerCategoryPicker` (a one-column layout).
- **i18n:** `reportGeneration.json` in `es` and `en`. New keys for the sidebar, the preview states and the format modal. The modal keys that are no longer used are removed.
- **Docs:** `content/documentation/{es,en}/` and `docs/onboarding.md`, where they describe stage 3.
- **Archive order:** after `progressive-flow-stages`, `territorial-analysis-by-category`, `territorial-analysis-routes`, `stage-one-unified-table`, `stage-two-flow-redesign`, `layer-analysis-contract` and `report-by-category`.
