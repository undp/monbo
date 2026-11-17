## 1. Categories in the web

- [x] 1.1 Add `GET_CATEGORIES_URL` to `config/env.ts` and `api/layerCategories.ts` (`getLayerCategories(country)`), and `interfaces/LayerCategory.ts` re-exporting the generated type (names shared with GC-7 and GC-8)
- [x] 1.2 Fetch categories together with the layers in `DataContext` (`availableCategories`, same request numbering, polling, per-country guard and error state); update `test/renderWithData.tsx` and the `DataContext` tests
- [x] 1.3 `utils/layerResults.ts`: `categoryRule`, `layerRule` (null for a missing category), `classifyResult` accepting a null rule, `classifyFarmInCategory`, `summarizeCategories`, `Polarity` from the contract; tests with a `required` category and a missing category
- [x] 1.4 `hooks/useLayerRules.ts`: rule and category per selected layer, with tests

## 2. Result texts and colors

- [x] 2.1 `utils/resultLabels.ts`: `layerResultText(value, category, t, language)` (ok label, "x % · flagged label" with the finding, "Sin dato"); tests for `avoid`, `required`, under the threshold and no data
- [x] 2.2 Chip color helpers and `formatDeforestationPercentage` take the rule (default `deforestationRule()`, so the PDF and exports are unchanged)

## 3. Grouped results table

- [x] 3.1 `components/reusable/Table.tsx`: optional `headerGroups` row
- [x] 3.2 `DeforestationResultsTable`: columns ordered and grouped by category, cells from `layerResultText`, counter chip with the category's color and icon, same props (`tableProps`, `mapsSubset`)
- [x] 3.3 Table tests: grouped header, a `required` category cell ("18% · Fuera de la frontera agrícola"), a layer whose category is missing

## 4. Results page

- [x] 4.1 `CategorySummaryCards` (one card per analysed category: ok label figure, flagged and no-data counts, meter), with tests
- [x] 4.2 Results page header: eyebrow, "Resultados del análisis territorial", polygons × layers line, "Cambiar capas" to the selection page; responsive at 390 px
- [x] 4.3 Map view: `MapView`, `FarmsList`, `SelectedPolygonsMap` use the selected layer's rule and category labels; `ResultsMapSelector` grouped by category with category color and icon; update `MapView.test.tsx`

## 5. Selection page

- [x] 5.1 `LayerCategoryPicker`: category cards (icon, color, name, description, "n de m capas") with a checkbox card per layer (name, source, period, resolution), with tests
- [x] 5.2 Rebuild `DeforestationAnalysisUploadDataPageContent`: eyebrow, title, Paso 1 / Paso 2, notices (validated with inline subset, loaded without validation, direct entry with "Subir polígonos" / "Ir a validación"), bottom bar with counts and "Analizar"
- [x] 5.3 Start the analysis only on "Analizar", after an upload, or to recalculate an outdated analysis; never on mount; regression test for the back-button path
- [x] 5.4 Remove `DeforestationModal`; the stage 1 next-stage card and the stepper navigate to the stage 2 page (`stageAction`, `FlowStepper`, `polygonsValidation/PageFooter`); update `flowStages` and stepper tests

## 6. i18n and docs

- [x] 6.1 Keys in `locales/es` and `locales/en` (`deforestationAnalysis`, `flow`, `polygonValidation`), removing the ones of the deleted modal; translation parity test green
- [x] 6.2 Update `docs/onboarding.md` if it describes the analysis modal or the stage 2 flow

## 7. Verification

- [x] 7.1 Run the app with CO configured with three categories locally (per-country layout with a `categories.json`), check selection and results in the browser at desktop and 390 px, and take screenshots
- [x] 7.2 Run the web CI checks locally: `pnpm install --frozen-lockfile`, schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`

## 8. Review of #140 (2026-11-17)

- [x] 8.1 Keep the page's choices in `analysisDraft`, apart from the analysed `deforestationAnalysisParams`; write the params only when an analysis succeeds; test the review's scenario
- [x] 8.2 Send, show and count only offered layers; test the `maps` sent after a category is disabled
- [x] 8.3 Format a flagged finding with `formatDeforestationPercentage` ("< 0,1%" with a threshold of 0); make `formatFindingPercentage` never return "0%" for a finding above 0 and document it; edge tests
- [x] 8.4 "Sin dato" in the map chips and the table counter
- [x] 8.5 Counter of farms without findings in green with the category's icon
- [x] 8.6 "Cambiar capas", the stage 1 card and "Ir a validación" keep the language
