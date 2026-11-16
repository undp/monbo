## 1. Classification module

- [x] 1.1 Create `apps/web/src/utils/layerResults.ts` with `Polarity`, `ClassificationRule`, `ResultClass`, `findingRatio`, `classifyResult` (percent comparison of design D3, `null`/`undefined` → `unknown`), `deforestationRule()` and `countResults`
- [x] 1.2 Add `groupFarmsByResult(farms, mapResults, rule)` to the module, returning the farms per class for one layer
- [x] 1.3 Write `utils/layerResults.test.ts`: both polarities, a value exactly on the threshold for each polarity, threshold 0, `null` and missing results, the default rule reading `GET /config`, and the grouping helper

## 2. Replace the scattered rules

- [x] 2.1 `utils/styling.ts`: add `resultClassColor` / `resultClassBackgroundColor`; make the value-based chip colour helpers delegate to `classifyResult(value, deforestationRule())`
- [x] 2.2 `utils/numbers.ts`: `formatDeforestationPercentage` asks the classification instead of `isDeforestationAboveThreshold`
- [x] 2.3 `utils/deforestation.ts`: remove `isDeforestationAboveThreshold` and its tests; keep `isOverlapAboveThreshold`
- [x] 2.4 `hooks/useDeforestationFreeResultsCountByMap.tsx`: count `ok` with `countResults`, `null` when every result is `unknown`; update its test with a below-threshold value
- [x] 2.5 `DeforestationResultsTable.tsx`: cell text from the class (`ok` → free label, `flagged` → "x% Def.", `unknown` → "N/A") through `deforestationResultShortText` in the new `utils/resultLabels.ts`
- [x] 2.6 `SelectedPolygonsMap.tsx`: popup text from `deforestationResultShortText`
- [x] 2.7 `MapView.tsx`: group with `groupFarmsByResult`; add the "No data" tab, shown only when it has farms
- [x] 2.8 `DeforestationFreeCounterChip.tsx`: colour from `resultClassColor("ok")`
- [x] 2.9 `utils/deforestationReport/sections.tsx`: the farm page text comes from `deforestationResultReportText` (`utils/resultLabels.ts`); the appendix uses the class colours
- [x] 2.10 Add `deforestationAnalysis:noDataShortText` to `locales/es` ("Sin dato") and `locales/en` ("No data")
- [x] 2.11 Confirm with a search that no `value === 0`, `value > 0` or `100 * value` classification of a deforestation result remains in `apps/web/src` outside `utils/layerResults.ts`

## 3. Regression and consistency tests

- [x] 3.1 Regression test for the bug: a farm with `null` lands in the "No data" group, not the free one (`groupFarmsByResult`)
- [x] 3.2 Consistency test on one fixture (`0`, `0.005`, `0.02`, `0.05`, `null`, threshold 2): the counter hook, the map grouping, the table cell text and the PDF farm text all give 3 free

## 4. Checks and docs

- [x] 4.1 Run the web CI checks from `apps/web`: schema check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`
- [x] 4.2 Add a `CHANGELOG.md` "Unreleased" entry describing the fix and the visible counter change
- [x] 4.3 Check `docs/`, `apps/web/README.md` and the methodology page (`content/documentation/*/deforestation.md`) for statements about how "free" is decided and update them
