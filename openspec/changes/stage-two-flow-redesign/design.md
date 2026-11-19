## Context

Stage 2 lives in two pages today:
- `/territorial-analysis/upload-data` (`TerritorialAnalysisUploadDataPageContent`, 635 lines) does several jobs on one page:
  - a direct-entry warning;
  - the subset radio buttons in an `Alert`;
  - the layer picker;
  - an embedded `FarmsUploadStep` that analyses as soon as a file is parsed;
  - a sticky summary bar with "Analizar".
- `/territorial-analysis` shows the results in the layout from before the redesign:
  - padding 3;
  - a search bar and a table/map toggle above a `SectionBackground`;
  - `CategorySummaryCards`;
  - `LayerResultsTable` on the reusable `Table`, with chips;
  - the `NextStageCard` that opens `MapSelectionModal`.

Stage 1 was rebuilt by `progressive-flow-stages` and `stage-one-unified-table` on shared pieces. `FlowPage` keeps the content as wide as the stepper. The other pieces are `FlowPageHead`, `FlowSection`, `flowTable`, the full-width bottom bar of `FarmsUploadStep variant="page"` and `NextStageCard`. Stage 1 also keeps its upload list in `DataContext` (`stageOneUploadSources`), so "Agregar más polígonos" can go back to it. Stage 2 empties that list when the user uploads there, and its own list isn't kept.

The v2 mockup splits stage 2 into three screens: upload (direct entry only), layers with a banner and a bottom bar, and the results. Decisions agreed with the product owner: one shared upload list (1A); the no-validation banner only informs (2A); search, the Excel/GeoJSON download and the report layer modal stay.

## Goals / Non-Goals

**Goals:**
- Direct entry uploads first, with stage 1's exact upload page, and "Continuar" leads to the layers.
- The layers page matches the mockup: the banner with the subset choice and "Ver polígonos", the category and layer cards, and the bottom bar with "Analizar".
- One upload list for the flow, which both stages show and edit.
- The results page matches the mockup and reuses stage 1's layout and table style.
- The analysis starts only from "Analizar", or to recalculate an outdated analysis.

**Non-Goals:**
- A GLOBAL / NACIONAL tag per layer: the API has no such field. It is a follow-up for the admin (GC-5).
- Changing the report layer modal, the map view itself or the analysis contract.
- Restyling the report stage. It reuses `LayerResultsTable` and inherits the table style, but keeps its columns.

## Decisions

### 1. Three routes, one job each

```
/territorial-analysis/upload-data   polygons   (FarmsUploadStep variant="page", "Continuar")
/territorial-analysis/layers        new        (banner + layers + bar with "Analizar")
/territorial-analysis               results
```

- `upload-data` keeps its URL, because GC-13's redirects from `/deforestation-analysis/upload-data` land there. It becomes the upload only.
- `layers` takes the selection logic of today's page:
  - the draft;
  - `requestedMaps`;
  - the analysis effect with `prevDataRef` and `latestRequestRef`;
  - the recalculation on open;
  - the hidden-layer filter.

  The logic moves; it isn't rewritten.
- The new upload page is small: `UploadPageContent` plus `FarmsUploadStep variant="page"`, like stage 1's page, with `submitLabel` "Continuar".
- Targets:
  - `flowStages.ts`: stage 2 goes to the results, else to `layers` when `farmsData`, else to `upload-data`.
  - `ChangeLayersButton`, stage 1's `PageFooter` and `AnalysisOutdatedGuard` go to `layers`.
  - `layers` without farms does `router.replace` to `upload-data`.

Alternative: one route with an internal step. Rejected, because the browser's back button, the stepper and "Ver polígonos" need URLs.

### 2. One upload list for the flow (1A)

- `stageOneUploadSources` is renamed `uploadSources` (`useKeptState` key and setter), and both upload pages use `useUploadSources(country, { kept: true })`.
- Stage 2 no longer empties the list.
- Stage 1 drops its validate-on-entry effect (`validatedOnEntry`): with a list there is always something to show, and validating is the user's call.
- "Agregar más polígonos" depends on `uploadSources.length > 0`.

Alternative: two lists. Rejected, because the stage 2 list would be lost on a visit to stage 1, and a user who uploaded on stage 2 and then wants to validate would have to upload again.

### 3. Confirming an unchanged list keeps the results

- `DataContext` counts the list's changes: `setUploadSources` raises `uploadSourcesRevision` on every call. `farmsSourcesRevision` is the count the current `farmsData` were parsed from.
- The two confirmations behave differently:
  - Stage 2's "Continuar" compares the two counts. If they are equal, it goes to `layers` without parsing.
  - Otherwise it parses (`generateFarmsData`), sets `farmsData` and `farmsSourcesRevision`, and clears the rest: validation results, analysis results, `analysisOutdated` and the report choices (as stage 1 does).
  - Stage 1's "Validar" always validates, which is what the button asks for, and records the count.
- Every change counts, including a re-read after a country change or an edit that leaves the list equal. Then the list reads as changed and the results are dropped. That direction is safe.
- The draft (layers and subset) is kept: it is a choice, not a result.

Alternative: a signature of the list (source keys, deleted rows, manual rows). Rejected, because a re-read after a country change keeps the source keys while its rows change, so the signature can miss an edit. The counter can't miss one.

### 4. Upload no longer starts an analysis (D25, replaces part of D22)

D22 started the analysis "with 'Analizar' or after uploading a file". On the split pages, uploading leads to the layers page, so "Analizar" is the only trigger, besides the recalculation of an outdated analysis. The `draft` mode is set only by `onAnalyze`, and `performFarmsGeneration` no longer sets it. To be recorded as D25 in undp/monbo#116.

### 5. The banner (2A)

`SubsetBanner` is an info band (`FLOW_COLORS` blue tint, info icon), with "Ver polígonos" at its right.
- **With validation:** "Usarás {{count}} polígonos de la validación." followed by a segmented choice "Solo los válidos (N) | Todos (M)".
  - With "valid", the excluded IDs follow: the first three, then "y N más". The text says "quedan fuera porque no pasaron la validación". The mockup says "hasta que corrijas su geometría", but a farm can be left out for an overlap too.
  - "Ver polígonos" goes to `/polygons-validation`.
- **Without validation:** "Usarás {{count}} polígonos. No pasaron por la validación." "Ver polígonos" goes to `/territorial-analysis/upload-data`.

### 6. Shared bottom bar

The full-width sticky bar of `FarmsUploadStep` moves to `components/page/flow/FlowBottomBar.tsx` (stats as children, the action at the right). The upload uses it ("N polígonos · N puntos · Continuar"), and so does the layers page ("N polígonos · N capas en N categorías · Analizar", with `SummaryStat`).

### 7. Layers as the mockup

`LayerCategoryPicker` keeps its data and props, and only its look changes:
- one card per category: icon tile in the category tint, name, description, and "N de M capas" at the right;
- a 3-column grid of layer cards (1 column on phones) with a checkbox, the name, "source · period" and the tags (period, resolution);
- a ticked card is outlined in the category's color.

The section is a `FlowSection` "Capas para el análisis" with the action "Cómo leer cada capa ↗". The action opens `/documentation#layers` in a new tab.

### 8. Results page as the mockup

- **Shell.** `FlowPage` + `FlowPageHead`:
  - title "Resultados del análisis territorial";
  - subtitle "N polígonos cruzados con N capas de {{country}}.";
  - `actions` = `ChangeLayersButton` + `DownloadPageData`, both outlined.
- **Cards.** `CategorySummaryCards` is restyled:
  - icon tile, name and "N capas" at the right;
  - "N de M" large with the `ok` label;
  - a meter split ok / flagged / unknown.
- **Section.** `FlowSection` "Resultado por polígono y capa", with these actions:
  - in the table view: the `SearchBar` (compact) and "Ver en el mapa";
  - in the map view: `ResultsMapSelector` and "Ver tabla".

  The view stays in `?view=`. The section grows with its rows up to `RESULTS_SECTION_HEIGHT`, with a sticky header. It uses the same frame rule as stage 1's table (the frame is the only scroll container). The map view takes the full `RESULTS_SECTION_HEIGHT`.
- **Table.** `LayerResultsTable` gets a `farmColumns` prop:
  - `"compact"` (ID in blue, Productor) on stage 2;
  - `"full"` (type, ID, producer, crop, as today) from `ReportResultsTable`.

  The headers and cells use `FLOW_TABLE_SX`. The category group row keeps its icon and color. The chips become pills: check + `ok` label on the ok tint, "x % · flagged label" on the bad tint, and "Sin dato" on gray.
- **Footer.** `PageFooter` (the next-stage card + `MapSelectionModal`) is unchanged.

## Risks / Trade-offs

- **[Stage 1 no longer validates on entry the farms uploaded on stage 2.]** → The list is shown with "Validar". That is one click more, and it is explicit. The spec says so.
- **[The report stage inherits the table style.]** `ReportResultsTable` reuses `LayerResultsTable`. → It keeps its columns through `farmColumns="full"`. The new style matches the flow, so this is intended. The report preview tests cover it.
- **[A missed change to the list would keep stale results.]** → Every call to `setUploadSources` raises the count, and only the upload hook and starting over call it. A test covers adding, editing a drawn farm and deleting a row.
- **[Moving the analysis logic to a new page.]** It holds subtle guards (stale responses, the country changing mid-request, Strict Mode). → It moves as is, with its tests (`TerritorialAnalysisUploadDataPageContent.test.tsx` becomes the layers page's). New tests cover only the new triggers.
- **[Two open changes touch these requirements.]** → Archive after `progressive-flow-stages`, `territorial-analysis-by-category`, `territorial-analysis-routes` and `stage-one-unified-table`, in that order.

## Migration Plan

Web only, with no contract change. The kept-state key changes (`stageOneUploadSources` → `uploadSources`). The flow's state lives in the tab and is cleared on refresh, so nothing old needs reading. The work is one PR to `feat/layer-manager`, and it reaches `dev` with the integration PR (#145).

## Open Questions

None.
