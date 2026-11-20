## 1. One upload list for the flow

- [x] 1.1 Rename `stageOneUploadSources` / `setStageOneUploadSources` to `uploadSources` / `setUploadSources` in `DataContext` (kept-state key included) and every use
- [x] 1.2 Add `uploadSourcesRevision` (raised by every `setUploadSources`) and `farmsSourcesRevision` (the count the farms were parsed from) to `DataContext`; clear the latter on start over
- [x] 1.3 Stage 1: record the count when "Validar" parses the list; drop the validate-on-entry effect; offer "Agregar más polígonos" when `uploadSources.length > 0`
- [x] 1.4 Tests: the count goes up on add, drawn-farm edit and row delete, and not otherwise; stage 1 doesn't validate on entry with farms from stage 2

## 2. Shared bottom bar

- [x] 2.1 Move the full-width sticky bar out of `FarmsUploadStep` into `components/page/flow/FlowBottomBar.tsx` (stats as children, action on the right); `FarmsUploadStep` uses it with no visible change

## 3. Stage 2 upload page

- [x] 3.1 Rewrite `TerritorialAnalysisUploadDataPageContent` as the upload only: `UploadPageContent` ("Análisis territorial", "Súbelos como prefieras…") + `FarmsUploadStep variant="page"` with the kept list and `submitLabel` "Continuar"
- [x] 3.2 "Continuar": with an unchanged count, go to `/territorial-analysis/layers`; otherwise parse, set the farms and the count, clear the validation and analysis results, `analysisOutdated` and the report choices, keep the draft, and go to `layers`. Keep the flow-generation and unmount guards
- [x] 3.3 Tests: direct entry shows the upload; "Continuar" goes to layers without analysing; an unchanged list keeps the results; a changed one drops them

## 4. Stage 2 layers page

- [x] 4.1 Add `app/[locale]/territorial-analysis/layers/page.tsx` and `TerritorialAnalysisLayersPageContent`, moving over the draft, `requestedMaps`, the analysis effect, the recalculation on open and the hidden-layer filter from today's page; `draft` mode only from "Analizar"
- [x] 4.2 Without farms, `router.replace` to `/territorial-analysis/upload-data`
- [x] 4.3 `SubsetBanner`: with validation, the count, the "Solo los válidos (N) | Todos (M)" choice and the excluded IDs (three, then "y N más"); without validation, the count and "No pasaron por la validación"; "Ver polígonos" to `/polygons-validation` or `/territorial-analysis/upload-data`
- [x] 4.4 Restyle `LayerCategoryPicker` as the mockup (category cards with "N de M capas", 3-column layer cards outlined in the category color) inside a `FlowSection` "Capas para el análisis" with "Cómo leer cada capa ↗" to `/documentation` in a new tab
- [x] 4.5 `FlowBottomBar` with "N polígonos · N capas en N categorías" and "Analizar"
- [x] 4.6 Move today's page tests to the layers page; add: the banner both ways, "Ver polígonos" targets, no farms → upload, back button doesn't analyse

## 5. Routes

- [x] 5.1 `utils/flowStages.ts`: stage 2 → results, else `layers` with farms, else `upload-data`; `layers` counts as stage 2
- [x] 5.2 `ChangeLayersButton`, stage 1's `PageFooter` and `AnalysisOutdatedGuard` go to `/territorial-analysis/layers`
- [x] 5.3 Update the flow stage tests and check GC-13's `/deforestation-analysis/*` redirects still land on the upload

## 6. Results page

- [x] 6.1 `/territorial-analysis` on `FlowPage` + `FlowPageHead` ("Resultados del análisis territorial", "N polígonos cruzados con N capas de {{country}}.") with `ChangeLayersButton` and `DownloadPageData` as `actions`
- [x] 6.2 Restyle `CategorySummaryCards`: icon tile, name, "N capas", "N de M" + `ok` label, ok/flagged/unknown meter
- [x] 6.3 `FlowSection` "Resultado por polígono y capa": search and "Ver en el mapa" in the table view, `ResultsMapSelector` and "Ver tabla" in the map view (`?view=`); grows up to `RESULTS_SECTION_HEIGHT` with a sticky header
- [x] 6.4 `LayerResultsTable`: `farmColumns` (`compact` on stage 2, `full` from `ReportResultsTable`), `FLOW_TABLE_SX`, ID in blue, result pills (ok / flagged / unknown)
- [x] 6.5 Tests: the head, the map toggle, compact vs full columns, the pills' texts (existing scenarios), the sticky header
- [x] 6.6 Map view in the flow's style: a 320 px farm panel (search, result filters as pills with their counts, one row per farm with its ID, producer and finding), the map in a fixed-height frame so it fits the farms, and the layer's legend over the map

## 7. Texts and docs

- [x] 7.1 `territorialAnalysis.json` and `common.json` keys in `es` and `en` (upload title and subtitle, "Continuar", banner, "Cómo leer cada capa", results head and section, "Ver en el mapa" / "Ver tabla"); drop the keys left unused (`directEntry`, `uploadStep`)
- [x] 7.2 Update `content/documentation/{es,en}/` and `docs/onboarding.md` where they describe stage 2
- [x] 7.3 Record D25 (upload no longer starts the analysis; one upload list for the flow) in undp/monbo#116, and the GLOBAL / NACIONAL tag as a follow-up

## 8. Checks

- [x] 8.1 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build`
- [x] 8.2 `openspec validate stage-two-flow-redesign --strict`
- [x] 8.3 Check by hand in `pnpm dev`: direct entry → upload → Continuar → layers → Analizar; "Ver polígonos" both ways; an unchanged and a changed list; the subset choice after a validation; results head, cards, table, map toggle, search and the report modal

## 9. Review of #148

- [x] 9.1 The map list announces each farm's finding and is one Tab stop with arrow keys; its result filters are toggle buttons (`aria-pressed`), not tabs
- [x] 9.2 The banner's IDs are shown as text (`AS_TEXT`), never escaped
- [x] 9.3 An emptied list keeps the upload bar, with its button off, while farms are loaded; "Agregar más polígonos" is offered whenever the farms came from the list
- [x] 9.4 Leaving a recalculation with no layer to run doesn't bring the loading screen back
- [x] 9.5 Onboarding and the `farm-upload` requirement say that only stage 2's "Continuar" keeps the results of an unchanged list
- [x] 9.6 The stage 1 test covers the case the removed validate-on-entry effect handled (farms and no list)
