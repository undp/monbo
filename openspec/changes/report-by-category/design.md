## Context

The PDF report is built in the browser with `@react-pdf/renderer` 4, in a worker (`workers/reportPdf.worker.tsx`) that receives structured-cloneable data: farms, results, maps, image blobs, the locale and the runtime config. Today it renders:

1. a cover titled "Reporte Análisis / Deforestación" (`deforestationReport/sections.tsx` `CoverPage`);
2. one page per farm × layer with a non-null result, with the farm's data, "x% DEFORESTATION" or "DEFORESTATION FREE" from `deforestationResultReportText` (always the deforestation rule), the GeoJSON link, documents and the map image with a Google Maps caption;
3. a "deforestation calculation" appendix;
4. one page per layer with its attributes and considerations, hidden when all its results are `null`.

A `null` result produces no page, and a farm with only `null` results disappears. The exports (`utils/resultsExport.ts`, `utils/geojson.ts`) write the formatted `value` with hardcoded Spanish or English headers.

After GC-1 (#132), `GET /categories?country=CC` returns the country's enabled categories with both languages, `polarity`, a resolved `thresholdPercentage`, `resultLabels` and `color`/`icon`; `GET /maps` gives each layer's `categoryId`. After GC-4 (#130), `utils/layerResults.ts` is the one classifier (`classifyResult(value, rule)`), still fed with `deforestationRule()` everywhere. The web does not fetch categories yet: GC-6 (stage 2 by category, running in parallel and merging first) needs them too.

The reference design is stage 3 of the mockup v2 (cover "sin resultados", "Ficha y resultados", "Metodología", "Alcances y límites").

## Goals / Non-Goals

**Goals:**

- Cover without results (D8), with the categories included and an index.
- One sheet per farm with every selected layer's result grouped by category, in the category's words, with "No data" instead of omission.
- Classification by the layer's category, through `classifyResult`, in the PDF and both exports.
- Generic methodology, and per-layer scope and limits.
- Localized export headers naming category and layer.
- Satellite caption only when the map has the satellite background; regenerated sample reports.

**Non-Goals:**

- Images and tiles (API): unchanged, still red.
- The stage 2 screens, the category grouping of the layer selection and the stage-2 results table (GC-6).
- Renaming files, components or the `/report-generation` route (GC-13), or rewording other screens (GC-11).
- The polygon-validation Excel sheets, whose headers are bilingual by design of the upload template.
- The ZIP pipeline. The large-report threshold stays at 1000 farm pages (D9).

## Decisions

### D1. Categories reach the report through `DataContext`, fetched with the layers

`api/layerCategories.ts` (`getLayerCategories(country)`) is called together with `getMaps` in `DataContext`'s existing fetch and poll, and stored as `availableCategories` with the same "belongs to this country" guard as the maps. `interfaces/LayerCategory.ts` re-exports `components["schemas"]["LayerCategory"]`. `utils/layerResults.ts` gains `categoryRule(category): ClassificationRule`.

Coordination with GC-6: these are the pieces GC-6 needs too. If GC-6 merges first with its own client, hook or rule helper, this change drops its copy on rebase and uses GC-6's; only the report, exports and their tests depend on the names. The names above are proposed to GC-6 through the orchestrator.

*Alternative:* the report fetches categories itself. Rejected: two sources for the same country data, and the exports in stage 2 need them as well.

### D2. One view-model helper shared by the PDF and the exports

`utils/layerCategories.ts` holds pure helpers, with no React:

- `localizedText(text, language)`: picks `es`/`en`, falling back to `es`.
- `groupLayersByCategory(maps, categories)`: the selected layers grouped in the order of `GET /categories`, then by layer id; layers whose category is unknown go to a trailing group with no category.
- `layerResult(value, map, category, language)`: `{ resultClass, findingRatio, label }` where `resultClass` comes from `classifyResult(value, categoryRule(category))`, `label` from the category's `resultLabels` (or "No data"), and `findingRatio` from `findingRatio(value, polarity)`. Without a category, the class is `unknown`.
- `categoryClass(classes)`: flagged > unknown > ok.

The sheet, the methodology, the Excel and the GeoJSON all go through it, so the four cannot disagree. `resultLabels.ts`'s `deforestationResultReportText` (PDF only) is removed; `deforestationResultShortText` stays for the stage 2 table until GC-6 replaces it.

### D3. Layer without a known category is "No data"

A layer can be in a finished analysis while its category is missing from `GET /categories` (disabled after the analysis, or broken: D14/D15). Classifying it with a guessed rule could invert a polarity. Its results are shown as "No data" in a group labelled with the layer only ("Sin categoría" / "No category"), and the methodology lists it without a rule. A silently wrong result is worse than a missing one.

### D4. Report structure

```
Cover (no results) ─ "This report includes": categories × layer count; index (linked)
For each farm:
  Sheet: data · GeoJSON link · documents · results by category (rows per layer)
  Map pages: one per layer with a non-null result (category · layer · label · image)
Methodology (one page)
Scope and limits: one page per selected layer (attributes + considerations + category)
```

- **Sheet + map pages instead of thumbnails.** The mockup puts small thumbnails on the sheet. The map images are 640×420 evidence; at thumbnail size the loss pixels are unreadable. The sheet keeps every result on one page, and each map keeps today's size on its own page, titled with its category, layer and label. The number of image pages does not change; each farm adds one sheet page, which has no image and which the large-report count includes (D9).
- **Index without page numbers.** react-pdf cannot know a later page's number while it lays out the cover (a long consideration or a farm with many layers wraps). The index lists the sections and links to them with react-pdf's internal links (`<Link src="#methodology">` to an element with `id`). Every page footer shows "page n of N" through react-pdf's `render` prop, so the reader can still navigate on paper.
- **Order of categories** follows `GET /categories` (deforestation first), as stage 2 does.
- **Footer** keeps "Análisis realizado con …" and adds the page number.
- **Cover meta:** association, country, date and number of polygons. Producer and area are per farm, so they live on the sheet.

### D5. The worker receives categories and the satellite flag

`ReportPdfRequest` and the ZIP `start` command gain `categories: LayerCategory[]` and `satelliteBackground: boolean` (the selection's `satelliteFor(s)`, which already decides whether the images include it). The selection key in `ReportContext` includes the categories' ids, polarities, thresholds and labels, so a category edited by the admin re-renders the preview instead of reusing a stale PDF.

### D6. Exports: two columns per layer, i18n headers

Per layer, after the template's columns: `"{{category}} · {{layer}} — % hallazgo"` and `"… — Resultado"` (keys in `common:layerResults`). A single "label (18 %)" column would be unreadable to a spreadsheet; two columns keep both sortable. In the Excel the finding is a numeric cell in percent, rounded to 4 decimals (`findingPercentCell`): sortable, and the same in `es` and `en`; the "< threshold" reading lives in the result column. The GeoJSON keeps the formatted text (`formatFindingPercentage`, the same "< x %" rule as the screens). `null` → "Sin dato"/"No data", as text, in both. The sheet name moves to i18n. Both exports take the analysed layers (`deforestationAnalysisParams.selectedMaps`), not today's catalog (`availableMaps`): a layer whose category was disabled after the analysis leaves `GET /maps`, and must still show, as "No data" (D3). `buildDeforestationSheets` and `generateGeoJsonFarmsDataWithDeforestationAnalysis` keep their names (GC-13 renames) and gain `categories` and `t` parameters; `DownloadPageData` passes them.

### D7. Methodology is generic

The formula is "share of the polygon = area that coincides with the layer / total area of the polygon × 100", then the finding per polarity, the threshold rule and "No data". A table lists each category in the report: name and colour, its description (what counts as coinciding), polarity reading ("coinciding is a finding" / "not coinciding is a finding"), threshold, and both labels. A second table lists each layer with its category, source, period (`baseline`–`comparedAgainst` for temporal categories, otherwise the content date) and resolution; its coverage, often a long text, stays on its scope and limits page. The old deforestation appendix keys are removed.

### D8. Satellite caption

Shown under a map only when `satelliteBackground` is true. Its text becomes generic ("The satellite image from Google Maps is for reference only and does not show the layer's result"). This resolves the note in `public/files/examples/README.md`, whose step 7 is updated.

### D9. The large-report count includes the sheets

`countFarmPages` counts one sheet per selected farm plus one map page per (farm, layer) pair with a result, which is what the complete PDF has. Counting only the map pages would let a report of 2600 farms, of which 1000 have a result, render 3600 pages at once. The threshold stays at 1000: a complete PDF then has at most 1000 farm pages, fewer than 1000 of them with an image, below the 2000 image pages measured as safe. Some reports between 1000 map pages and 1000 farm pages move from the complete PDF to the ZIP.

## Risks / Trade-offs

- [GC-6 builds the same categories plumbing with other names] → names proposed through the orchestrator before coding; on rebase this change adopts GC-6's and deletes its own.
- [The module 3 results table is rebuilt by GC-6] → this change does not touch `reportGeneration/DeforestationResultsTable.tsx` until GC-6 merges; then it rebases and adapts it in the same PR.
- [Internal links not supported in some viewers] → the index still names the sections; the page numbers in the footer remain.
- [A category edited between analysis and report changes the result] → expected: the report uses the categories in force, as stage 2 does; the preview re-renders when they change (D5).
- [More pages per farm (+1 sheet)] → the large-report rule counts the sheets too (D9). A ZIP per farm grows by one light page.
- [Sample PDFs are binaries in git] → regenerated once, at the end; the unit PR is squashed (D19).
- [Local testing with three categories] → the repo's maps use the flat layout (deforestation only). The real-PDF check uses a temporary per-country root with `CO/categories.json` and the existing rasters reassigned to three categories, outside the repo.

## Migration Plan

Web only, no contract change. Ships with the `feat/layer-manager` → `dev` integration PR. Rollback is reverting the unit's squash commit; the API keeps serving `GET /categories` either way.

## Open Questions

- Confirm sheet + map pages (D4) over thumbnails on the sheet.
- Confirm the index without page numbers, with links and page numbers in the footer (D4).
- Confirm two export columns per layer (D6).
- Confirm "No data" for a layer whose category is missing (D3).
- Confirm with GC-6 the shared names of D1.
