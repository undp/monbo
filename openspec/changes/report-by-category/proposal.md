## Why

Layers now belong to per-country categories (GC-1), each with a polarity, a threshold and its own result wording, and the web classifies results in one place (GC-4). The PDF report and the Excel and GeoJSON exports still speak only of deforestation:

- The cover is titled "Reporte Análisis / Deforestación", and the client asked that it show no results (D8).
- There is one page per farm × layer with "x% DEFORESTATION" or "DEFORESTATION FREE", always classified with the deforestation rule, so a `required` layer (agricultural frontier) would print an inverted result.
- A `null` result is skipped without a word (`utils/deforestationReport.tsx:88`): a farm whose every result is `null` vanishes from the report, which is audit evidence.
- The Excel header is Spanish-only (`Deforestación según …`, `utils/resultsExport.ts:182`) and the GeoJSON property is English-only (`Deforestation according to …`, `utils/geojson.ts:96`).
- The map caption mentions Google Maps imagery even when the map has no satellite background, as in the sample reports of the start page.

This change is unit GC-7 of the layer-manager project (undp/monbo#116, sub-issue #123).

## What Changes

- **Cover without results.** Titled "Reporte de análisis territorial" / "Territorial analysis report". It keeps association, country of origin and date, adds the number of polygons, and a "This report includes" block: the categories of the selected layers with their number of layers, and an index of the report's sections, linked inside the PDF. No percentage, class or label appears on it.
- **One sheet per farm, grouped by category.** It replaces the farm × layer pages as the place where results are read: the farm's data, GeoJSON link and documents, then each category with its icon colour, its overall result and one row per layer (name, period, finding percentage, result label). The labels are the category's `resultLabels` in the report's language; the class comes from `classifyResult` with the category's rule. A `null` or missing result is shown as "Sin dato" / "No data", never skipped, and the farm is never dropped.
- **Map pages** follow each farm's sheet: one per layer with a result, as today, titled with its category and layer. The satellite caption appears only when the map has the satellite background.
- **Generic methodology page**: the formula (share of the polygon that coincides with the layer), what the finding is for each polarity, the threshold rule, what "No data" means, a table with each category of the report (what counts as a finding, its threshold and its two labels) and a table with the layers used.
- **"Scope and limits" pages per layer**: today's map description pages (attributes and considerations), with the layer's category. They are shown for every selected layer, also when all its results are `null`.
- **Excel and GeoJSON exports** with headers through i18n that name the category and the layer, a finding-percentage column and a result-label column per layer, "No data" for `null`, and a localized sheet name.
- **Categories in the web**: `GET /categories?country=CC` is fetched with the country's layers and kept in `DataContext`; `categoryRule(category)` in `utils/layerResults.ts` turns a category into the classification rule. If GC-6 lands these first, this change uses GC-6's instead (see design).
- The report worker receives the categories and whether the maps have the satellite background.
- The sample reports of the start page (`public/files/examples/{es,en}/`) are regenerated, and their README updated.

## Capabilities

### New Capabilities

- `category-report`: what the PDF report says and how it is organised by layer category: cover without results, per-farm sheet grouped by category with "No data", map pages, generic methodology, and per-layer scope and limits.

### Modified Capabilities

- `report-generation`: a report's farm pages, which decide whether it is large, count one sheet per farm as well as the map pages.
- `results-export`: the layer-results export names the category and the layer in its headers, in the user's language, with the finding and the result label per layer and "No data" for `null`; the GeoJSON export does the same in its properties.

## Impact

- Web only (`apps/web/src`): `utils/deforestationReport.tsx`, `utils/deforestationReport/sections.tsx` and `styles.ts`, `workers/reportPdf.worker.tsx` and `reportPdfProtocol.ts`, `context/ReportContext.tsx`, `context/DataContext.tsx`, `utils/layerResults.ts`, `utils/resultLabels.ts`, `utils/resultsExport.ts`, `utils/geojson.ts`, `components/page/deforestationAnalysis/DownloadPageData.tsx`; new `api/layerCategories.ts`, `interfaces/LayerCategory.ts`, `utils/layerCategories.ts`.
- The module 3 results table (`components/page/reportGeneration/DeforestationResultsTable.tsx`) is adapted to GC-6's table after GC-6 merges.
- i18n: new keys in `reportGeneration` and `common` (`es` and `en`); obsolete report keys removed.
- `config/env.ts`: `GET_CATEGORIES_URL`, a per-endpoint build-time override that falls back to `NEXT_PUBLIC_API_URL` (no runtime placeholder needed).
- No API, contract, ratio, image or tile change. The large-report threshold stays at 1000 farm pages, now counting each farm's sheet as well as its map pages (`report-generation`).
- `public/files/examples/{es,en}/` sample PDFs regenerated (binary files; the unit PR is squashed).
