## 1. Categories in the web (replaced by GC-6's pieces in 6.1)

- [x] 1.1 `interfaces/LayerCategory.ts` re-exporting the schema's `LayerCategory`; `GET_CATEGORIES_URL` in `config/env.ts`; `api/layerCategories.ts` with `getLayerCategories(country)`
- [x] 1.2 `DataContext`: fetch the categories with the country's layers (fetch and poll), expose `availableCategories` for the selected country only; tests in `DataContext.test.tsx`
- [x] 1.3 `categoryRule(category)` in `utils/layerResults.ts`, with tests for both polarities

## 2. Shared view model

- [x] 2.1 `utils/layerCategories.ts`: `localizedText`, `groupLayersByCategory` (API order, unknown-category group last), `layerResult` (class, finding, label, "No data"), `categoryClass`
- [x] 2.2 Tests: `required` category, `null` and missing results, unknown category, ordering, labels in both languages
- [x] 2.3 i18n keys in `es` and `en` (`common` for result and export texts, `reportGeneration` for the report); remove obsolete report keys

## 3. PDF report

- [x] 3.1 Cover without results: new title, association, country, date, polygon count, "This report includes" with categories × layers, linked index
- [x] 3.2 Farm sheet: farm data, GeoJSON link, documents, results grouped by category (overall class, "n of m categories without findings", one row per layer with period, finding and label; "No data" for null/missing)
- [x] 3.3 Map pages: one per layer with a result, titled with category, layer and label; satellite caption only with `satelliteBackground`
- [x] 3.4 Methodology page: generic formula, polarity, threshold, "No data", categories table, layers table
- [x] 3.5 Scope and limits pages: every selected layer, with its category; keep the considerations renderer
- [x] 3.6 Footer with page n of N; internal-link targets for the index
- [x] 3.7 `DeforestationReportDocument`: new structure, never drops a farm, no throw on a missing result
- [x] 3.8 Worker protocol and worker: `categories` and `satelliteBackground` in the request and the ZIP start; `ReportContext` passes them and keys the selection on the categories

## 4. Exports

- [x] 4.1 `buildDeforestationSheets`: two localized columns per layer (finding, result) in category order, "No data" for null, localized sheet name
- [x] 4.2 `generateGeoJsonFarmsDataWithDeforestationAnalysis`: the same two properties per layer with localized names
- [x] 4.3 `DownloadPageData` (stage 2) and the PDF's GeoJSON link pass categories and `t`
- [x] 4.4 Tests in `resultsExport.test.ts` and `geojson.test.ts`: English headers, `required` category, null, re-upload still parses

## 5. Report tests

- [x] 5.1 Section tests: cover has no percentage nor label; sheet groups by category, shows "No data" for null, keeps a farm with only nulls; methodology lists a `required` category; scope page for an all-null layer; caption only with satellite background
- [x] 5.2 Worker test: request with categories renders; ZIP start carries them (`reportPdfClient.test.ts` / new worker test)

## 6. Module 3 table (after GC-6 merges)

- [x] 6.1 Rebase on `origin/feat/layer-manager` and adopt GC-6's pieces, deleting this change's copies: the four of D21 (`api/layerCategories.ts`, `interfaces/LayerCategory.ts`, `availableCategories`, `categoryRule`), `formatFindingPercentage` (GC-6's signature: the finding and the threshold), and from `utils/layerCategories.ts` `localizedText`, `groupLayersByCategory`, `categoryOf` (→ `layerCategory`) and `categoryClass` (→ `classifyFarmInCategory`); `layerCategories.ts` keeps only the report's own helpers
- [x] 6.2 Adapt `components/page/reportGeneration/DeforestationResultsTable.tsx` to GC-6's table

## 7. Verification and samples

- [x] 7.1 Generate a real PDF in the browser with three categories (temporary per-country layers root with `CO/categories.json`) and review it page by page, in `es` and `en`
- [x] 7.2 Regenerate `public/files/examples/{es,en}/` sample reports following their README, and update the README (step names, caption note)
- [x] 7.3 Update docs that describe the report (`docs/onboarding.md` if it names the report sections) and the `report-generation`/`results-export` mentions
- [x] 7.4 Local checks (D20) for `apps/web`: frozen install, schema check, `tsc --noEmit`, lint, tests, build

## 8. Review of #141 (first phase)

- [x] 8.1 Large-report count includes the farm sheets (D9), with the 2600 farms / 1000 results case
- [x] 8.2 Exports take the analysed layers: a layer whose category was disabled stays, with "No data"
- [x] 8.3 Excel finding column is numeric, in percent
- [x] 8.4 Long words (URLs) break after their separators instead of running off the page; checked in the real PDF
- [x] 8.5 Worker test loads the worker once and reads only its own responses
- [x] 8.6 Sample reports link their GeoJSON to a public API, not localhost; README updated
- [x] 8.7 A list item that opens a sublist is kept with it
- [x] 8.8 After the rebase: category colors through `categoryTints` (green and red only for the result class, D23); a real PDF reviewed in the browser
- [x] 8.9 Second review: references printed in lines react-pdf never breaks (D10); a heading, a sublist's opening item and the considerations' title stay with what follows; `layerResultText` built from `layerResult`, with one key per text
- [x] 8.10 Third review: only short considerations go in unbreakable blocks (D11); a paragraph longer than a page prints whole, checked with react-pdf's layout and in the real PDF
- [x] 8.11 Fourth review: the layout tests measure with Roboto and place lines right after a page break; tests for the keep-ahead and the title; blocks also capped in lines; keep-ahead of two lines
