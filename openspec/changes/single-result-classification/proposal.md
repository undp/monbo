## Why

The web decides whether a farm is "deforestation-free" in four different ways, and one of them is silently wrong: `MapView.tsx:44-48` puts a farm whose result is `null` (it could not be computed) in the deforestation-free group. That breaks the invariant that the `null` sentinel never reaches a result as a real value, and the result becomes audit evidence. The other definitions disagree with each other (`value === 0` in the table and the counter, `100 × value > threshold` in the map and the chip colours, `value > 0` in the PDF), so the same farm can be "free" in one screen and "deforested" in the next.

The layer-categories project (undp/monbo#116) adds categories with a polarity (`avoid` or `required`), where the finding of a `required` layer is `1 − value`. If each screen keeps its own rule, an inverted polarity gives a wrong result with no visible error. One classification function, used everywhere, removes both problems. This change is unit GC-4 (undp/monbo#120).

## What Changes

- New module `apps/web/src/utils/layerResults.ts`, the only place that turns a result `value` into a class:
  - `findingRatio(value, polarity)`: `value` for `avoid`, `1 − value` for `required`;
  - `classifyResult(value, rule)`: `ok`, `flagged` or `unknown`, where `rule` is `{ polarity, thresholdPercentage }` and `flagged` means `100 × finding > thresholdPercentage`. A `null` value is always `unknown`;
  - `deforestationRule()`: the default rule until categories are wired (GC-6), `avoid` with the deforestation threshold from `GET /config`;
  - colours per class, replacing the value-based colour checks.
- Every current definition is replaced by the module: results table (cell text and counter), the per-layer counter hook, the map's farm groups and popup, chip colours, percentage formatting and the PDF farm page and appendix.
- `MapView` gets a third group, "No data" / "Sin dato", for farms whose result is `null` or missing. They no longer count as deforestation-free. The tab shows only when the group is not empty.
- `isDeforestationAboveThreshold` is removed from `utils/deforestation.ts`; `isOverlapAboveThreshold` (module 1) stays.
- **User-visible:** a farm with `0 < value ≤ threshold` is now "deforestation-free" everywhere. Today the table counter and the table cell treat it as deforested ("< 2% Def." in green, not counted), the map and the colours treat it as free, and the PDF prints "0.5% DEFORESTATION" in green. With the dev threshold of 2%, the free counter grows by the number of such farms, and the table, the counter, the map and the PDF agree.

## Capabilities

### New Capabilities

- `result-classification`: how the web classifies a layer result as ok, flagged or no data from its value, the layer's polarity and threshold, and that every screen, counter and the PDF use that one classification.

### Modified Capabilities

- `frontend-unit-tests`: the pure-logic coverage list names the classification module (`utils/layerResults`) instead of the deforestation threshold check.

## Impact

- Web only (`apps/web/src`): `utils/layerResults.ts` and `utils/resultLabels.ts` (new), `utils/deforestation.ts`, `utils/styling.ts`, `utils/numbers.ts`, `utils/deforestationReport/sections.tsx`, `hooks/useDeforestationFreeResultsCountByMap.tsx`, and in `components/page/deforestationAnalysis/`: `MapView.tsx`, `DeforestationResultsTable.tsx`, `SelectedPolygonsMap.tsx`, `DeforestationFreeCounterChip.tsx` (`FarmsList.tsx` keeps its code and gets the class colours through `utils/styling.ts`).
- i18n: one new key, `deforestationAnalysis:noDataShortText`, in `es` and `en`. The methodology page (`content/documentation/*/deforestation.md`) stops saying that no-data farms appear in the free tab.
- No API, contract, ratio or infrastructure change. `DEFORESTATION_THRESHOLD_PERCENTAGE` keeps its name (D12).
- Consumers: GC-6 (stage 2 by category) and GC-7 (report by category) pass a category's rule to the same functions. `api/deforestationAnalysis.ts` (renamed by GC-12) is not touched.
