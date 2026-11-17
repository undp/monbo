## Context

- GC-1 (#132) added per-country categories to the API: `GET /categories?country=CC` returns the
  country's enabled categories (`id`, `name` and `description` in `{es, en}`, `icon`, `color`,
  `polarity`, `thresholdPercentage` already resolved, `resultLabels.{ok,flagged}` in `{es, en}`,
  `temporal`), and every layer of `GET /maps` has a `categoryId`. A layer whose category is
  disabled or broken is left out of `GET /maps` but still resolves by id for analyses and tiles.
- GC-4 (#130) put the classification in `apps/web/src/utils/layerResults.ts`
  (`classifyResult(value, rule)` → `ok | flagged | unknown`), with `deforestationRule()` as the
  only rule until categories are wired. Every stage 2 view, the PDF and the exports call it.
- GC-10 (#133) made the flow three stages with a stepper. Stage 2 is entered after a validation
  through `DeforestationModal` (subset + flat layer list), opened by the stage 1 next-stage card
  and by the stepper (`stageAction` → `"analysisModal"`). The stage 2 page
  (`DeforestationAnalysisUploadDataPageContent`) starts the analysis on mount when farms and
  layers are loaded, which is how the back button runs an analysis with a subset nobody chose.
- GC-7 runs in parallel and reuses `DeforestationResultsTable` in the report stage
  (`components/page/reportGeneration/DeforestationResultsTable.tsx`) through its props
  `tableProps` and `mapsSubset`. GC-6 merges first.
- Reference design: stage 2 of mockup v2 (`vEtapa2`, `vResults`).

## Goals / Non-Goals

**Goals:**

- Every stage 2 view classifies a layer's results with its category's rule.
- Stage 2 groups layers by category on selection and results, with the category's labels,
  color and icon.
- No analysis starts with a polygon subset the user didn't see and confirm.
- A table component GC-7 can reuse without changes.

**Non-Goals:**

- PDF report, Excel and GeoJSON exports: GC-7. They keep `deforestationRule()` until then.
- Tile colors per category: tiles stay red; recorded as a follow-up.
- Renaming `/deforestation-analysis`, the `deforestationAnalysis` namespace or the components:
  GC-13.
- The admin: GC-5.

## Decisions

### 1. Categories live in `DataContext`, fetched with the layers

`fetchAvailableMaps` fetches `GET /maps` and `GET /categories` together (`Promise.all`) for the
selected country, with the same request numbering, polling, on-demand refresh and per-country
guard. The context exposes `availableCategories: LayerCategory[]`, empty for another country's
list. Both lists arrive in one state update, so a layer is never shown without its category.

*Alternatives:* a separate `useCategories` hook with its own fetch (two lists that can disagree
for a poll interval; more code to keep in sync); embedding the category in `GET /maps` (an API
contract change outside this unit).

If `GET /categories` fails, the fetch fails as a whole and the existing "could not load the
layers" message shows: grouping layers without their categories would misclassify them.

`LayerCategory` is re-exported from `interfaces/LayerCategory.ts` (generated type, never hand-written).
`api/layerCategories.ts` (`getLayerCategories(country)`) calls `GET_CATEGORIES_URL` (`config/env.ts`, falls back to
`${NEXT_PUBLIC_API_URL}/categories`; build-time override only, so no runtime placeholder).

### 2. The rule of a layer comes from its category, and a missing category is "no data"

`layerResults.ts` gains:

- `categoryRule(category): ClassificationRule` → `{ polarity, thresholdPercentage }`.
- `layerRule(layer, categories): ClassificationRule | null`, `null` when the layer's
  `categoryId` is not among `categories`.
- `classifyResult(value, rule | null)`: a `null` rule gives `unknown`, as a `null` value does.

`Polarity` becomes the contract's type. `deforestationRule()` stays for the PDF and exports
(GC-7).

The stage 2 views get the rule from one hook, `useLayerRules()`, which maps each selected layer's
id to `{ category, rule }` from `deforestationAnalysisParams.selectedMaps` (they keep a hidden
layer's metadata while an analysis refers to it) and `availableCategories`.

A category whose threshold the admin changes mid-session reclassifies results on the next poll,
as a change to `GET /config` already does. Results don't change (`value` is the coverage, D4).

*Alternative considered:* falling back to the deforestation rule when the category is missing.
Rejected: for a `required` layer it inverts the result silently, the risk this orchestration
names first.

### 3. The category of a farm in a summary card

Per category and farm: `flagged` if any of the category's analysed layers is `flagged`;
otherwise `unknown` if any is `unknown`; otherwise `ok`. "No data" never counts as `ok`, and a
finding in one layer is never hidden by another. Pure function
`classifyFarmInCategory(classes: ResultClass[])` in `layerResults.ts`, plus
`summarizeCategories(...)` that returns, per category in the API's order, its layers and
`{ ok, flagged, unknown }` farm counts. Tested with a `required` category.

### 4. Texts of a result

- Cell and map popup, from the category's `resultLabels` in the UI language:
  - `ok` → `resultLabels.ok` (D16: also for `0 < finding ≤ threshold`, without percentage);
  - `flagged` → `"<finding %> · <resultLabels.flagged>"`, where the finding is `value` for
    `avoid` and `1 − value` for `required`;
  - `unknown` → "Sin dato" (existing `noDataShortText`).
- Summary cards use the category's `ok` label for the main figure and generic "Con
  observaciones" / "Sin dato" for the other two, so "Con observaciones" reads the same across
  categories.
- Map tabs: `resultLabels.flagged`, `resultLabels.ok`, "Sin dato" (only when it has farms).

`resultLabels.ts` gets `layerResultText(value, category | null, t, language)`; the old
`deforestationResultShortText` stays only while the PDF uses its sibling (GC-7 removes them).
`formatDeforestationPercentage` and the chip color helpers take the rule as an argument
(default: `deforestationRule()`, so GC-7's call sites keep compiling).

The finding percentage uses `formatPercentage` with the decimals of the deforestation display
(`deforestationDecimalPlaces()`), since a flagged finding is above the threshold by definition.

### 5. Grouped table: a header-group row in the generic `Table`

`Table` accepts an optional `headerGroups: { key, label, span, sx? }[]`, rendered as an extra
`TableRow` above the column headers; columns not covered by a group get an empty cell. The
results table builds one group per category (icon + name in the category's color, left border)
spanning its analysed layers, with the layer columns ordered by category (API order) then by
layer id.

`DeforestationResultsTable` keeps its name, file and props (`tableProps`, `mapsSubset`), so the
report stage (GC-7) shows grouped columns with no change. Its footer counter chip (per layer
`ok` count) uses the category's color and icon.

*Alternative:* a new `LayerResultsTable` component. Rejected for this unit: it forces GC-7 to
rebase onto a rename that GC-13 will do anyway.

### 6. Stage 2 selection page without the analysis modal

The page (`/deforestation-analysis/upload-data`) follows `vEtapa2`:

1. Eyebrow "Etapa 2 de 3", title "Análisis territorial", one-line subtitle with the country.
2. A notice depending on the flow:
   - farms with validation results: "Usarás N polígonos de la validación" with the subset
     choice inline (radio "Solo los válidos (N)" / "Todos (M)"), defaulting to the valid ones;
   - farms without validation (uploaded at stage 2): no notice; step 2 says how many are loaded;
   - no farms: warning "Llegaste directo…" with "Subir polígonos" (scrolls to step 2) and "Ir a
     validación" (`/polygons-validation/upload-data`).
3. "Paso 1: Elige las capas" — one card per category with its icon, color, name, description,
   "n de m capas", and a checkbox card per layer (name, source, period
   `baseline → comparedAgainst` when temporal, resolution).
4. "Paso 2: Agrega tus polígonos" — the existing upload step. With farms loaded it is collapsed
   behind "Cargar otro archivo".
5. A bottom bar with "N polígonos · M capas en K categorías" and "Analizar", disabled without
   farms or layers.

The analysis starts only from "Analizar", from a successful upload (as today), or to recalculate
an outdated analysis (`analysisOutdated`, which keeps the subset and layers already chosen).
Opening the page never starts it, whatever is in `DataContext`, which closes the back-button
path. `polygonsSubset` is always set by the page before analysing (`"valid"` default with
validation, `"all"` without).

`DeforestationModal` is removed. The stage 1 next-stage card and the stepper (`stageAction`
`"analysisModal"` → `"navigate"`, `stageHref(2)` → `/deforestation-analysis/upload-data` when
there are no results) navigate to the page. The results page gets "Cambiar capas", which goes back
to the selection page with farms and layers kept.

*Alternative:* keep the modal, group its layers too, and make the page ask for the subset
when it opens. Rejected as the default: two places choose the same thing, the layer grouping
would be duplicated in a modal, and the mockup has no modal.

### 7. Results page

Header: eyebrow, "Resultados del análisis territorial", "N polígonos cruzados con M capas de
<país>", the view toggle, search, download and "Cambiar capas". Under it, the summary cards
(one per analysed category, wrapping on narrow screens), then the table or the map in the
existing section, then the next-stage card. On 390 px, cards stack, the header wraps, and the
table scrolls horizontally inside its section.

`ResultsMapSelector` lists layers grouped by category (`ListSubheader` with icon and name), and
its counter chip uses the category's color. `MapView`, `FarmsList` and `SelectedPolygonsMap` take
the selected layer's rule and category labels.

## Risks / Trade-offs

- [The PDF and exports still use the deforestation rule until GC-7] → only on
  `feat/layer-manager`, never on `dev`; GC-7 is the next unit to merge. Noted in the PR.
- [Removing the analysis modal changes GC-10's spec] → delta on `analysis-flow-stages`, and
  `flowStages` tests updated; it is the unit GC-10 handed this path to.
- [Long result labels widen the table] → chips wrap within a max width, the section scrolls
  horizontally; labels are the country admin's texts (D1).
- [A broken categories fetch hides every layer] → same behaviour as a failed `GET /maps` today,
  with its message, retried on the next poll.
- [GC-7 conflicts in `DeforestationResultsTable`] → props unchanged; the PR describes the
  component's API.

## Migration Plan

Web only, no contract change. Rides the integration PR `feat/layer-manager` → `dev`. Rollback
is reverting the commit; the API is unaffected.

## Resolved at Puerta 1 (2026-11-17, @BlancaMunizaga)

- The analysis modal is removed: the stage 1 card and the stepper go to the stage 2 page.
- With a validation, "solo válidos" is preselected and visible before "Analizar".
- Shared names with GC-7 and GC-8: `api/layerCategories.ts` (`getLayerCategories(country)`),
  `interfaces/LayerCategory.ts`, `availableCategories` in `DataContext` (same fetch and poll as
  `getMaps`), and `categoryRule(category)` in `utils/layerResults.ts`.
