Groups 1 and 2 write disjoint files from group 3's spec check. Run the fix tripwires (2.1, 2.2,
2.3) against the pre-change `numbers.ts` and watch them fail before doing group 1.

## 1. Upper guard in the formatters

Files: apps/web/src/utils/numbers.ts

- [x] 1.1 Add `NEAR_FULL_TOLERANCE = 1e-10` and `formatBelowFull(value, decimals, language)`,
  as in design decision 1. Comment why the tolerance is not the classification's ULPs.
- [x] 1.2 `formatFindingPercentage`: its last return goes through `formatBelowFull` with the
  same decimals, after the threshold guards. Add the 100% rule to its contract comment.
- [x] 1.3 `formatResultPercentage`: the threshold-0 branch returns
  `formatFindingPercentage(finding, 0, language)`. Update its JSDoc.
- [x] 1.4 `formatOverlapPercentage`: both `formatPercentage` returns go through
  `formatBelowFull` with the same decimals. Update its JSDoc.

## 2. Tests

Files: apps/web/src/utils/numbers.test.ts, apps/web/src/utils/layerCategories.test.ts

- [x] 2.1 **Fix tripwire**, `formatFindingPercentage`:
  - `(0.9995, 5, "es")` → "> 99,9%" and `(0.9995, 5, "en")` → "> 99.9%";
  - `(0.99996, 2.25, "es")` → "> 99,99%";
  - `(0.9994, 5, "es")` → "99,9%".

  Mutant: `--find "shown >= 100" --replace "shown > 100"` in the helper.
- [x] 2.2 **Fix tripwire**, `formatResultPercentage` with a threshold of 0:
  - `avoid` 0.9995 → "> 99,9%";
  - `required` with threshold 5 and value 0.0004 → "> 99,9%".

  Mutant: in the threshold-0 branch, `--find "return formatFindingPercentage(finding, 0, language);"`
  `--replace "return formatPercentage(finding, DEFAULT_DECIMAL_PLACES, language);"`.
- [x] 2.3 **Fix tripwire**, `formatOverlapPercentage`: 0.9996 → "> 99,9%" with an overlap
  threshold of 0 and with 1.

  Mutant: in the threshold branch, `--find "return formatBelowFull(value, overlapDecimalPlaces(), language);"`
  `--replace "return formatPercentage(value, overlapDecimalPlaces(), language);"`.
- [x] 2.4 **Regression guard**: 1 reads "100%" in `formatFindingPercentage(1, 5)`,
  `formatResultPercentage(1, …)` with threshold 0, and `formatOverlapPercentage(1)`.

  Mutant: `--find "1 - value > NEAR_FULL_TOLERANCE" --replace "1 - value >= 0"`.
- [x] 2.5 **Regression guard**, float noise: `1 − 1e-12` reads "100%" in
  `formatFindingPercentage` and `formatOverlapPercentage`.

  Mutant: `--find "1 - value > NEAR_FULL_TOLERANCE" --replace "1 - value > 0"`.
- [x] 2.6 **Regression guard**, wiring to the report and exports: in `layerCategories.test.ts`,
  `layerResult(0.9995, makeCategory({ thresholdPercentage: 2 }), t, "es").findingText` is
  "> 99,9%".

  Mutant: same as 2.1.
- [x] 2.7 The existing `numbers.test.ts` cases keep passing unchanged. They pin the threshold-0
  text that decision 4 routes through `formatFindingPercentage`: "< 0,1%", "2,8%", "0%".

## 3. Spec and verification

Files: openspec/changes/cap-near-full-percentages/specs/product-configuration/spec.md

- [x] 3.1 `openspec validate cap-near-full-percentages --strict`.
- [ ] 3.2 In `apps/web`, all green:
  - `pnpm exec tsc --noEmit`;
  - `pnpm run lint`;
  - `pnpm test`;
  - `pnpm run build`.
