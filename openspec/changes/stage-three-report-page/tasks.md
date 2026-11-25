## 1. Report choices

- [x] 1.1 Replace `reportGenerationParams.initialFarmSelection` with `seeded: boolean` in `DataContext` (type, `initialReportGenerationParams`, kept state) and `test/renderWithData.tsx`
- [x] 1.2 Set `seeded: false` with the emptied lists at every reset site: `invalidateAnalysis`, the analysis on the layers page, the "new farms" branch of both upload pages; `resetAnalysis` through the initial value
- [x] 1.3 Tests: each reset site drops `seeded`

## 2. Preview on request

- [x] 2.1 `ReportProvider`: add `requestPreview()` that captures the current `Selection`; the preview effect renders only the requested one; `retryPreview` requests again
- [x] 2.2 Expose `previewState` (`idle | loading | ready | failed`), `isPreviewStale`, `isPreviewCurrent`, and the previewed `isLarge` / `farmCount` for the notices; keep `isLarge`, `farmCount` and `satelliteLimit` from the current choice
- [x] 2.3 Keep the complete pre-render after a requested preview; `getCompleteReport` uses the current choice (pre-rendered when the keys match, rendered otherwise)
- [x] 2.4 Tests: nothing renders on mount; a request renders that choice; a change during the render shows the requested PDF as stale; a download after a change saves the current choice; a large report previews one farm and pre-renders nothing

## 3. Report page

- [x] 3.1 `app/[locale]/report-generation/page.tsx` on `FlowPage` + `FlowPageHead` ("Etapa 3 de 3", "Reporte", subtitle), wrapped in `ReportProvider`, with the sidebar and the preview panel (side by side from `md`, stacked below); keep `AnalysisOutdatedGuard` and `NavigateHomepageWhenEmptyData`
- [x] 3.2 Seed on mount when `!seeded`: every visible farm, every visible analysed layer, `seeded: true`
- [x] 3.3 `ReportFarmList`: search by ID or producer (`?search=`, as the stage 2 map list), tri-state "Seleccionar todos" over the listed farms, rows in a box of bounded height, virtualized with `@tanstack/react-virtual` above 100 rows, checkbox labelled "{{id}} {{producer}}"
- [x] 3.4 `farmCategoryResults` in `utils/`: per farm and category with a ticked layer, the worst class (flagged > unknown > ok) and each layer's class and value, reusing `classifyResult` and `classifyFarmInCategory`; memoized per results, ticked layers and categories. The row writes each finding with `layerResult`, as the stage 2 pill
- [x] 3.5 Category icons on each row in `FLOW_RESULT_PILL` colours, with a tooltip of the findings ("GFW 3,42 % · TMF 1,18 % · IDEAM Libre") and an `aria-label`
- [x] 3.6 "Capas del reporte": `LayerCategoryPicker` with a new `columns` prop (`1` here), over the analysed layers, writing `selectedMaps`
- [x] 3.7 Actions: "Generar vista previa" / "Actualizar vista previa" (off with no farm, no layer or a current preview, with the caption that says why; sends `report_requested`, then requests the preview) and "Descargar" (off on an empty choice or during a ZIP job); no `DevEnvWarning` there: the flow header already shows it
- [x] 3.8 Preview panel: empty state, progress, the PDF iframe, the error with "Reintentar", the stale band with "Actualizar vista previa", and the large-report and satellite notices
- [x] 3.9 `/report-generation/preview` redirects (308, in `proxy.tsx`, keeping the locale prefix) to `/report-generation`; its page is removed
- [x] 3.10 Tests: defaults on the first visit and a kept choice on the way back; select all within a search; only analysed layers listed; the icons' colour and tooltip (flagged, no data, unticked layer); the button off with its reason; the stale band and going back to the previewed choice; no `report_requested` on entry; fewer than 100 rows in the DOM with 1000 farms

## 4. "Formato" modal

- [x] 4.1 `DownloadFormatModal` replaces `DownloadTypeSelectionModal`: radio cards "Un PDF con todo" / "Un PDF por polígono" (roving tabindex, arrows), "Descargar PDF" and "Descargar GeoJSON"; one farm without cards; a large report with the ZIP only, its reason and "Descargar ZIP (N PDFs)"; `downloadType` defaults to combined
- [x] 4.2 The large-report download closes the modal and shows `ZipProgress` as today; the PDF downloads show their loading state
- [x] 4.3 "Descargar GeoJSON": the ticked farms with the ticked layers' findings and results (`generateGeoJsonFarmsDataWithLayerAnalysis`), saved as `report.geojson`, with no usage event
- [x] 4.4 Tests: the three variants; combined vs separated download; GeoJSON contents; download without a preview and with a stale one; keyboard on the radio cards

## 5. Flow wiring and removals

- [x] 5.1 `utils/flowStages.ts`: drop `isReportSelectionReady`, `ReportSelection` and `reportModal`; `FlowStepper` navigates to stage 3 and loses `MapSelectionModal`
- [x] 5.2 Stage 2 `PageFooter`: "Continuar" pushes `/report-generation`
- [x] 5.3 Remove `MapSelectionModal`, `NoFarmsSelectedModal`, both report `PageFooter`s, `ReportGenerationPreviewPageContent`, `ReportResultsTable` and their tests; drop `farmColumns="full"` from `LayerResultsTable` if nothing else uses it
- [x] 5.4 Update `flowStages.test`, `FlowHeader.test`, `NextStageCards.test` and the stepper tests: stage 3 navigates, no dialog

## 6. Texts and docs

- [x] 6.1 `reportGeneration.json` in `es` and `en`: head, sidebar sections, "Seleccionar todos", the buttons and their captions, empty state, stale band, the "Formato" modal; remove `paramsSelectionModal`, `emptyFarmsSelectionModal`, `downloadTypeSelectionModal` and other unused keys
- [x] 6.2 Update `content/documentation/{es,en}/` and `docs/onboarding.md` where they describe stage 3 (keep the methodology word limit)

## 7. Checks

- [x] 7.1 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build`
- [x] 7.2 `openspec validate stage-three-report-page --strict`
- [x] 3.11 The stale notice's "Actualizar vista previa" follows "Generar vista previa" (`useReportPreviewRequest`): off with no polygon or no layer, saying which, and it sends `report_requested`
- [x] 7.3 Check by hand in `pnpm dev`: stage 2 "Continuar" and the stepper land on the report with everything ticked; search and select all; icons and tooltips; generate, change, stale band, update; the three modal variants; a large report's ZIP with progress; `/report-generation/preview` redirects

## 8. Review of #149

- [x] 8.1 The complete report is pre-rendered only when the previewed choice is still the current one
- [x] 8.2 The category icons' tooltip describes them (`describeChild`) and keeps their name; the icons take no focus, recorded in the design
- [x] 8.3 The stale notice is announced through a `role="status"` region that is always in the page, with the button outside it
- [x] 8.4 Remove `MultiSelectionStep` and `useMapsForSelectedCountry` (and its test), left unused with `MapSelectionModal`
- [x] 8.5 The report texts say "polígonos" / "polygons" everywhere, also in the preview notices and the ZIP progress
- [x] 8.6 The spec says "Descargar" is off while a large report's ZIP is built
- [x] 8.7 `frontend-unit-tests` no longer lists `useMapsForSelectedCountry` among the covered hooks
- [x] 8.8 The page test checks the stale notice's status region is in the page before the notice appears
