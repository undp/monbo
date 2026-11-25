## Why

A finding of 99.95% reads "100%" in the stage 2 table, the map, the PDF report and the GeoJSON
download, and an overlap of 99.96% reads "100%" in stage 1 (undp/monbo#166, unit MB-2 of #172).
The formatters round to the threshold's decimals (`formatFindingPercentage`,
`apps/web/src/utils/numbers.ts:228`) and, with a threshold of 0, call `formatPercentage`
directly (`apps/web/src/utils/numbers.ts:185-188`). Intl rounds 0.9995 with 1 decimal to
"100%". The report is audit evidence: "100%" reads as "the whole farm", which is not what the
data says. The low end of the scale already has its guard: a positive value that would round to
0 reads "< 0,1%" (`apps/web/src/utils/numbers.ts:236-237`).

## What Changes

- A percentage below 100% that would round to "100%" reads "> 99,9%" instead, with the
  decimals it is shown with ("> 99,99%" with a 2-decimal threshold), localized.
- A value within 1e-10 of 1 still reads "100%": a farm the layer covers entirely comes back
  from the API up to ~1e-12 below 1 because of floating point, and must not read "> 99,9%".
- The guard applies to every display of a finding (`formatResultPercentage`, with and without a
  threshold, and `formatFindingPercentage`) and of an overlap (`formatOverlapPercentage`).
- A threshold of 0 stops having its own formatting path for findings: it goes through
  `formatFindingPercentage`, which already gives the same text for it.
- The spec of threshold-dependent percentages gains the upper guard, and stops saying that the
  PDF formats its percentages on its own (it reads `layerResult` like the exports).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `product-configuration`: "Threshold-dependent percentages are displayed consistently" gains
  the rule that a value below 100% is never displayed as "100%", and covers the PDF report.

## Impact

- `apps/web/src/utils/numbers.ts` and `apps/web/src/utils/numbers.test.ts`.
- `apps/web/src/utils/layerCategories.test.ts` (one test pinning the wiring to the report and
  exports).
- No API change, no contract change, no new text to translate.

## Non-goals

- The Excel finding column, which is a number rounded to 4 decimals of a percent
  (`findingPercentCell`, `apps/web/src/utils/layerCategories.ts:91-95`): it only reaches 100
  within 0.00005% of the whole farm, as it reaches 0 at the other end. It stays as it is.
- The admin usage charts' percentages (`UsageCharts.tsx`, `AdminUsagePageContent.tsx`): they
  are usage shares, not farm data.
- Any change to how results are classified against the threshold (`classifyResult`).
