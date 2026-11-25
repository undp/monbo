## Context

The API returns, per layer and farm, `value`: the share of the farm on the layer's 1-pixels, between 0 and 1, or `null` when it could not be computed. The web turns that into "deforestation-free" or "deforested" in several places, each with its own rule:

| Where | Rule today | `null` / missing |
|---|---|---|
| `MapView.tsx:39-57` (farm groups) | `100 × value > threshold` | counted as **free** (the bug) |
| `useDeforestationFreeResultsCountByMap.tsx:14` (counter) | `value === 0` | not counted; `null` count when every value is `null` |
| `DeforestationResultsTable.tsx:78-85` (cell text) | `value === 0` → "Def. Free", else "x% Def." | "N/A" |
| `utils/styling.ts` (chip colours) | `100 × value > threshold` | grey |
| `SelectedPolygonsMap.tsx:177-184` (popup) | `100 × value > threshold` | "N/A" |
| `utils/numbers.ts:191` (formatting "< x%") | `100 × value > threshold` | n/a |
| `deforestationReport/sections.tsx:147-152` (PDF farm page) | `value > 0` | page skipped |
| `deforestationReport/sections.tsx:423-429` (PDF appendix colours) | colour of `0` and of `1` | n/a |

The threshold comes from `GET /config` (`getDeforestationThreshold()`, `config/runtime.ts`), which the PDF worker also loads. Categories with a polarity do not exist yet: GC-1 adds them to the API and GC-6 wires them into stage 2.

## Goals / Non-Goals

**Goals:**

- One function decides ok / flagged / unknown for a value and a rule, and every screen, counter and the PDF call it.
- `null` (and a missing result) is never "free".
- The rule is a parameter (`{ polarity, thresholdPercentage }`), so GC-6 and GC-7 pass a category's rule without touching the classification.

**Non-Goals:**

- Showing categories, per-category thresholds or category texts in the UI (GC-6, GC-7).
- Changing the ratio the API computes, the contract, or `DEFORESTATION_THRESHOLD_PERCENTAGE` (D12).
- Renaming the deforestation wording of labels (GC-11, GC-13). Existing keys keep their text.
- Exports (`resultsExport.ts`, `geojson.ts`): they print the formatted percentage or "N/D" and do not classify.
- The overlap check of module 1 (`isOverlapAboveThreshold`).

## Decisions

### D1. A pure module, `utils/layerResults.ts`

```ts
export type Polarity = "avoid" | "required";
export interface ClassificationRule { polarity: Polarity; thresholdPercentage: number }
export type ResultClass = "ok" | "flagged" | "unknown";

findingRatio(value: number, polarity: Polarity): number
classifyResult(value: number | null | undefined, rule: ClassificationRule): ResultClass
deforestationRule(): ClassificationRule      // { polarity: "avoid", thresholdPercentage: getDeforestationThreshold() }
countResults(values, rule): Record<ResultClass, number>
```

It has no React and no i18n, so the PDF worker, hooks and components share it. `classifyResult` accepts `undefined` so a farm without a result for a layer ("missing") goes through the same path as `null` instead of each caller deciding.

*Alternative:* keep `utils/deforestation.ts` and add polarity there. Rejected: the module would be named after one category, and GC-6/GC-7 consume it for every category.

### D2. `Polarity` is a local type until GC-1 lands

The categories' shape belongs to the API contract, and `CLAUDE.md` forbids writing an API shape by hand. Today no API shape carries a polarity, so the module declares `Polarity` itself. When GC-1 adds the category model to `openapi.json`, GC-6 replaces the local alias with the schema's type (`interfaces/` re-export). Same values (`avoid`, `required`), so the switch is a type swap.

### D3. Comparison in percent, tolerant only of floating-point rounding

`flagged` is `100 × finding − threshold > 8 × Number.EPSILON × scale`, where `scale` is the larger of the two numbers compared (and at least 100 for `required`, because `1 − value` is rounded at the scale of 1). A raw `100 × finding > threshold` puts a value that is exactly on the threshold a hair above it: `100 × 0.07` is `7.000000000000001`, `100 × (1 − 0.58)` is `42.00000000000001`, `100 × (1 − 0.99)` is `1.0000000000000009`. Over every threshold in quarter points from 0 to 100, the raw comparison flags 28 farms that sit exactly on it; this one flags none, for both polarities, and still flags a finding one ten-thousandth of a point past the threshold (`layerResults.test.ts`; an extra sweep in hundredths of a point and 6-decimal values, 40,004 checks, also found none). For `avoid` the tolerance is relative, so a threshold of 0.0000001% (the API accepts any percentage, and `numbers.test.ts` covers one) keeps a finding of 0.00000015% flagged.

*Alternatives:*
- `100 − 100 × value` for `required` (the first version of this change) fixes 0.99 but not 0.58 with a threshold of 42, and leaves `avoid` with the same problem (0.07 with 7).
- Rounding both sides to a millionth of a point (suggested in review) fixes the boundaries but erases thresholds below that resolution: with a 0.0000001% threshold every finding under 0.0000005% reads as on it.
- A fixed absolute epsilon has the same problem as the fixed resolution.

### D4. Colours by class, value-based helpers delegate

`utils/styling.ts` gains `resultClassColor(cls)` and `resultClassBackgroundColor(cls)`. The existing `getDeforestationPercentageChipColor(value)` and `...BackgroundColor(value)` keep their signature and call `classifyResult(value, deforestationRule())`, so the list, table and popup don't change shape. The PDF appendix and the counter chip use the class colours directly (`ok`, `flagged`) instead of "the colour of 0" and "the colour of 1", which today depend on the threshold (with a threshold of 100, the colour of `1` is green).

### D5. Labels follow the class

- Table cell and map popup: `ok` → "Def. Free", `flagged` → "x% Def.", `unknown` → "N/A". The table no longer uses `value === 0`.
- PDF farm page: `ok` → "DEFORESTATION FREE", `flagged` → "x% DEFORESTATION".
- Both texts live in `utils/resultLabels.ts` (`deforestationResultShortText`, `deforestationResultReportText`), next to the classification rather than inside the components, so the table and the popup share one function and the PDF text is tested without rendering a PDF. The module is separate from `layerResults.ts` because it needs i18n and formatting, which the classification doesn't.
- Farm list chip: unchanged, it shows the formatted percentage with the class colour.
- `formatDeforestationPercentage` keeps its output; its "below the threshold" branch asks `classifyResult(value, deforestationRule()) === "ok"`.

So a farm with `0 < value ≤ threshold` shows the deforestation-free label in the table and the PDF, not its percentage. Decided by the product owner on 2026-11-16, over keeping the green "< 2% Def." text: it is what the map popup already shows, and it makes every view say the same thing.

### D6. "No data" group in `MapView`

`MapView` groups farms with `classifyResult` into flagged, ok and unknown. The unknown farms get a third tab, `deforestationAnalysis:noDataShortText` ("Sin dato" / "No data"), shown only when it has farms, so the common case keeps two tabs in a 22%-wide column (decided by the product owner on 2026-11-16, over always showing it with a count of 0). The grouping moves into a pure helper (`groupFarmsByResult`) so the tab counts are testable without rendering Leaflet.

### D7. One counting path

The counter hook counts `ok` through `countResults`, and stays `null` when every result of the layer is `unknown`. The map groups, the table cells and the PDF labels all come from `classifyResult` with the same rule, so a test feeds one fixture to the hook, the grouping helper and both label functions and asserts the same "free" count.

## Risks / Trade-offs

- **Visible change in the free counter** → Farms with `0 < value ≤ threshold` move from "not free" to "free" in the table counter and table cell (they were already green and "free" in the map). With the dev threshold of 2%, the counter rises by that many farms. This is the intended rule (the threshold is the product's definition of a finding); it is called out in the PR and the CHANGELOG.
- **A third tab in a narrow column** → Shown only when there are farms with no data.
- **Local `Polarity` type drifts from the API's** → Same literal values; GC-6 swaps it for the schema type, and the tests by polarity fail if the meaning flips.
- **Tabs that appear and disappear** → `ClassicTabs` used to read the selected tab during the render that removed it, and threw (switching layers from the "No data" tab to a layer without such farms). It now clamps the index in the render itself; the effect only syncs the state.
- **Removing `isDeforestationAboveThreshold`** → A caller added in parallel (GC-6, GC-7, GC-10) would fail the type-check on rebase, which is the point: it must use the module.

## Migration Plan

Web-only, ships with train 1. No data migration. Rollback is a revert of the PR.

## Open Questions

None for this unit. Closed on 2026-11-16 by the product owner: below-threshold farms show the free label (D5), and the "No data" tab shows only when it has farms (D6).
