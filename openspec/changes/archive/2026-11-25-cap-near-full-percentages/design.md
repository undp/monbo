## Context

Every display of a layer finding goes through `formatResultPercentage`
(`apps/web/src/utils/numbers.ts:176`):

- the stage 2 table, through `FarmsList.tsx:121` and `layerResult`
  (`apps/web/src/utils/layerCategories.ts:59`);
- the map popups (`resultLabels.ts:18`, used by `SelectedPolygonsMap.tsx` and
  `LayerResultsTable.tsx`);
- the PDF (`utils/report/sections.tsx:298`, `ReportFarmList.tsx:47-48`);
- the GeoJSON download (`geojson.ts:100-101`);
- the admin category preview (`CategoryPreview.tsx:112`).

Overlaps go through `formatOverlapPercentage` (`numbers.ts:140`), in `FarmOverlapsModal.tsx:124`
and the stage 1 Excel (`resultsExport.ts:132`).

Today:

- `formatResultPercentage` with a threshold of 0 formats the finding with
  `formatPercentage(finding, 1)` (`numbers.ts:185-188`).
- Above a threshold it calls `formatFindingPercentage` (`numbers.ts:195`), which guards the low
  end (`numbers.ts:236-237`) and the threshold (`numbers.ts:249-252`), but not 100%.
- `formatOverlapPercentage` calls `formatPercentage` in both branches (`numbers.ts:150`, `:157`).

`Intl.NumberFormat` rounds half away from zero, so 0.9995 with 1 decimal and 0.99996 with 2 read
"100%".

The API clamps the ratio to [0, 1] (`apps/api/app/modules/layer_analysis/helpers.py:41`). A farm
the layer covers entirely sums its pixels' intersections and lands on either side of 1. Measured
on 2026-11-25 with 300 random 12-vertex farms on a 0.00025° grid with shapely: 151 below 1, with
a deficit of at most 8.1e-13 and a median of 2.4e-15. The tolerance of the classification
(8 ULPs at scale 100, about 1.8e-15 relative, `layerResults.ts:31-51`) is far too tight for that:
half the fully covered farms would read "> 99,9%".

## Goals / Non-Goals

**Goals:**

- No value below 100%, beyond floating-point noise, reads "100%" in any display of a finding or
  an overlap.
- The text stays consistent with the existing guards: the threshold guards
  (`> 5%`, `< 5%`) keep priority, and the low end keeps "< 0,1%".

**Non-Goals:** see the proposal (the Excel numeric column, the admin usage charts,
classification).

## Decisions

1. **One helper, `formatBelowFull(value, decimals, language)`, in `numbers.ts`.**
   - It formats like `formatPercentage`.
   - When `1 − value > NEAR_FULL_TOLERANCE` and the rounded text would be 100 or more, it
     returns `> ` followed by `formatPercentage(1 − 10^−decimals / 100, decimals, language)`:
     "> 99,9%", "> 99,99%".
   - The rounded value is read the way `formatFindingPercentage` already reads `shown`
     (`numbers.ts:240-242`, the "en" format without `%` or `,`).
   - The statement is always true: a value that rounds to 100 is at least
     100 − resolution / 2, which is above 100 − resolution.
2. **`NEAR_FULL_TOLERANCE = 1e-10`, as a fraction of the farm.**
   - It is about 100× the largest deficit measured above, and 10⁷× below the 1-decimal
     resolution (1e-3).
   - Rejected: no tolerance, or the classification's ULPs. A fully deforested farm would read
     "> 99,9%" about half the time.
   - Rejected: a tolerance tied to the display resolution (for example half of it). That brings
     back the bug, because 0.9995 would be "close enough".
3. **`formatFindingPercentage` applies the helper on its last line** (`numbers.ts:253`), after
   the threshold guards. With a threshold of 99.9 and a finding of 0.99951, the threshold guard
   does not fire (shown 100 > 99.9) and the helper returns "> 99,9%", which is the same text.
4. **`formatResultPercentage` with a threshold of 0 calls
   `formatFindingPercentage(finding, 0, language)`** instead of its own branch
   (`numbers.ts:185-188`).
   - With threshold 0, `formatFindingPercentage` has 1 decimal and a resolution of 0.1, so its
     low guard returns `< ${formatPercentage(0.001, 1)}`, the same text as
     `formattedDefaultDisplayThreshold`.
   - Above 0 its threshold guards cannot fire: shown ≥ 0.1 > 0, and nothing is below 0.
   - One path for every finding, so the new guard cannot be missed on one of them.
5. **`formatOverlapPercentage` uses the helper in both branches** (`numbers.ts:150`, `:157`),
   with the decimals it already uses. `formattedDefaultDisplayThreshold` stays for the overlap.

## Data shape / API contract / cross-stack wiring

N/A: the web's formatting only. No route, model or generated type changes.

## Hazards (Step 2b)

- `apps/web/src/utils/numbers.ts`
  - **Threshold guards.** #66 fixed threshold formatting, and #140 (6514691) added
    `formatFindingPercentage` with the `> X%` / `< X%` guards and the ULP tolerance. The upper guard
    must not override them, so it goes after them.
  - **Float noise.** The shared tolerance (`THRESHOLD_ROUNDING_ULPS`) is not reused: see
    decision 2.
- `apps/web/src/utils/numbers.test.ts`
  - **Runtime config.** It relies on `withThresholds` to set the runtime config
    (`numbers.test.ts:14-21`). The overlap cases must set it, or they read the previous test's
    threshold.
- `apps/web/src/utils/layerCategories.test.ts`: no known hazard. It builds categories with
  `makeCategory` (`layerCategories.test.ts:18`).

## Signal tracing

N/A: the change introduces no marker, label, verdict or state between stages. It only changes
display text.

## Risks / Trade-offs

- **[Threshold with 9 or more decimals]** The resolution is then at or below the tolerance: a
  value within 1e-10 of 1 reads "100%" even though its exact text would be "99,9999999…%".
  A threshold that precise is not a real product setting. Accepted.
- **[Text of a fully covered farm]** It keeps "100%" thanks to the tolerance. It is pinned by a
  regression test at 1 − 1e-12.

## Migration Plan

None. The fix ships with the next release; there is nothing to deploy in order.
