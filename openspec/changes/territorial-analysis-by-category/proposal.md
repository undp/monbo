## Why

Layers now belong to a per-country category with its own polarity, threshold and result
labels (GC-1, `GET /categories`), and the web classifies results in one module (GC-4). Stage 2
still shows a flat layer multiselect, a table of `"x% Def."` cells and a "deforested / free"
map, and every result is read with the deforestation rule. A country with an agricultural
frontier layer (`required`) would get inverted results without any visible error. Stage 2 also
starts the analysis on mount with a polygon subset nobody chose when the browser's back button
lands on it after a validation (pending from GC-10).

Part of the "Gestor de capas" orchestration (undp/monbo#116), unit GC-6 (undp/monbo#122).

## What Changes

- The web fetches the selected country's categories (`GET /categories?country=CC`) together
  with its layers, and keeps them in `DataContext` (`availableCategories`).
- Each layer result is classified with **its category's rule** (polarity and resolved threshold)
  through `utils/layerResults.ts`. A layer whose category is not among the country's categories
  is classified `unknown` ("Sin dato"): the web never guesses its rule.
- **Stage 2 selection page** (`/deforestation-analysis/upload-data`), rebuilt after mockup v2:
  - "Etapa 2 de 3", title "Análisis territorial" and the steps "Paso 1 / Paso 2".
  - Layers grouped by category: a card per category with its icon, color, name, description and
    "n de m capas", and a checkbox card per layer.
  - With validated farms, the polygon subset ("solo válidos" / "todos") is chosen **on the
    page**, next to the layers. Without farms, a notice says the user came in directly and offers
    "Subir polígonos" and "Ir a validación"; stage 2 is not blocked (D5).
  - The analysis starts **only** from the "Analizar" button or after a file is uploaded, never
    on mount. The one exception is recalculating an outdated analysis, which reuses the inputs
    the user already chose.
- **The analysis modal goes away.** The stage 1 next-stage card and the stepper go straight to
  the stage 2 page, where the subset and the layers are chosen. This closes the back-button path
  for good: no state left by a modal decides the analysis.
- **Stage 2 results page** (`/deforestation-analysis`):
  - title "Resultados del análisis territorial", with how many polygons were crossed with how
    many layers, and a "Cambiar capas" action;
  - one summary card per category with how many farms are `ok`, `flagged` ("Con observaciones")
    and `unknown` ("Sin dato");
  - the results table with a header row grouping the layer columns by category (icon, color,
    name), and cells with the category's result label and, when flagged, the finding percentage;
  - the map view with the selected layer's category labels in its tabs and popup, and the
    category's color and icon in the layer selector and its counter chip. Tiles stay red.
- `Table` gains an optional header-group row; `DeforestationResultsTable` keeps its props
  (`tableProps`, `mapsSubset`) so the report stage (GC-7) reuses it unchanged.
- i18n keys in `es` and `en` for every new text.

Out of scope: the PDF report and the Excel / GeoJSON exports (GC-7, which keep the deforestation
rule until then), tile colors per category (follow-up), renaming routes and the namespace
(GC-13), the admin (GC-5).

## Capabilities

### New Capabilities

- `territorial-analysis`: the stage 2 screens grouped by layer category: the selection page
  (subset, grouped layers, direct-entry notice, when the analysis starts) and the results page
  (summary per category, grouped table, map labels and colors).

### Modified Capabilities

- `result-classification` (added by `single-result-classification`, GC-4): the rule of each
  layer comes from its category instead of the global deforestation rule, in the stage 2 views.
- `analysis-flow-stages` (added by `progressive-flow-stages`, GC-10): stage 2 is entered
  without the analysis modal; the next-stage card and the stepper go to the stage 2 page, and the
  known back-button path is closed.

## Impact

- Web only. No API, contract or `openapi.json` change: `GET /categories` and `categoryId` exist
  since GC-1.
- New `apps/web/src/api/layerCategories.ts` (`getLayerCategories(country)`), `interfaces/LayerCategory.ts` and `GET_CATEGORIES_URL` in `config/env.ts` (a
  build-time per-endpoint override that falls back to `NEXT_PUBLIC_API_URL`, so no runtime
  placeholder edits).
- `context/DataContext.tsx`, `utils/layerResults.ts`, `utils/resultLabels.ts`,
  `utils/styling.ts`, `utils/numbers.ts`, `utils/flowStages.ts`, `components/reusable/Table.tsx`.
- `components/page/deforestationAnalysis/*` (selection page, results table, map view, selector,
  chip), `components/page/polygonsValidation/PageFooter.tsx` and `DeforestationModal.tsx`
  (removed), `components/page/flow/FlowStepper.tsx`.
- `locales/{es,en}/deforestationAnalysis.json`, `flow.json`, `polygonValidation.json`.
- GC-7 reuses `DeforestationResultsTable` with the same props; GC-13 renames it.
