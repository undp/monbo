## 1. Theme palette and the styling helpers

Files: apps/web/src/config/theme.ts, apps/web/src/config/theme.test.tsx, apps/web/src/utils/styling.ts

- [x] 1.1 `config/theme.ts`: export `RESULT_COLORS` with the ten keys and values of design.md
      Decision 1; add `result` to the `Palette` and `PaletteOptions` augmentation; set
      `palette.result: RESULT_COLORS`.
- [x] 1.2 `utils/styling.ts`: build both maps from `RESULT_COLORS`; exported functions unchanged.
- [x] 1.3 Regression guard in `config/theme.test.tsx`: `theme.palette.result` equals the ten
      literal values (written as literals in the test, not imported); it pins "no visual change".
      Regression guard of the values (red pre-change only because `result` doesn't exist yet);
      falsified post-change by its mutant:
      `--file apps/web/src/config/theme.ts --find 'meterFlagged: "#f2b8b2"' --replace 'meterFlagged: "#f2b8b3"'`.

## 2. Components read the theme

Files: apps/web/src/components/page/territorialAnalysis/CategorySummaryCards.tsx, apps/web/src/components/page/territorialAnalysis/CategorySummaryCards.test.tsx, apps/web/src/components/page/territorialAnalysis/NoObservationsCounterChip.tsx, apps/web/src/components/page/territorialAnalysis/NoObservationsCounterChip.test.tsx, apps/web/src/components/page/territorialAnalysis/MapView.tsx, apps/web/src/components/page/territorialAnalysis/MapView.test.tsx, apps/web/src/components/reusable/ResultChip.tsx, apps/web/src/components/reusable/ResultChip.test.tsx

Each test below renders the component inside `ThemeProvider` with a test theme built from the app
theme whose `palette.result` overrides one key with a sentinel (e.g. `#123456`), and asserts the
element's `getComputedStyle` is the sentinel's rgb. All four are **fix tripwires**: red on the
pre-change tree (the literal ignores the theme). Write each test first and observe it red.

- [x] 2.1 `NoObservationsCounterChip.test.tsx` (new): with `count={null}`, the chip's background
      is `result.unknownBackground` and its text `result.unknown`; a second case with the real
      theme asserts `rgb(213, 213, 213)` / `rgb(103, 103, 103)` (regression guard). Then switch
      the component to `sx` palette paths. Mutant (post-change):
      `--find 'backgroundColor: "result.unknownBackground"' --replace 'backgroundColor: "#D5D5D5"'`.
- [x] 2.2 `CategorySummaryCards.test.tsx`: the flagged meter segment uses `result.meterFlagged`
      (locate the segment by a `data-result-class` attribute added to it, or by order inside the
      aria-hidden meter). Then change `METER_COLORS`. Mutant:
      `--find 'flagged: "result.meterFlagged"' --replace 'flagged: "#f2b8b2"'`.
- [x] 2.3 `MapView.test.tsx`: the legend swatch uses `result.layerTile`. Then delete
      `TILE_COLOR`. Mutant: `--find 'backgroundColor: "result.layerTile"' --replace 'backgroundColor: "#ff0000"'`.
- [x] 2.4 `ResultChip.test.tsx` (new): `kind="neutral"` uses `result.neutralBackground`;
      `kind="ok"` with the real theme is `rgb(46, 125, 50)` (regression guard). Then delete
      `NEUTRAL_CHIP_BACKGROUND`. Mutant:
      `--find 'background: "result.neutralBackground"' --replace 'background: "#eef2f6"'`
      (adjust the find to the final code; it must be single-site).
- [x] 2.5 Done when `grep -nE '#f2b8b2|#c7d3df|#D5D5D5|#676767|#ff0000|#eef2f6' ` over the four
      component files returns nothing and their tests pass.

## 3. Eyebrow contrast

Files: apps/web/src/components/page/flow/flowStyles.ts, apps/web/src/components/page/flow/PageEyebrow.tsx, apps/web/src/components/page/flow/PageEyebrow.test.tsx, apps/web/src/test/contrast.ts

- [x] 3.1 `src/test/contrast.ts`: `contrastRatio(foreground, background)` per WCAG 2.x relative
      luminance, for `#rrggbb`.
- [x] 3.2 `PageEyebrow.test.tsx` (new), fix tripwire, written first and observed red: render
      `PageEyebrow` in the app theme; its computed color has `contrastRatio ≥ 4.5` against
      `#ffffff` and against `FLOW_COLORS.blue25`, and equals `rgb(38, 122, 80)`. Mutant
      (post-change): `--file apps/web/src/components/page/flow/flowStyles.ts --find 'eyebrow: "#267a50"' --replace 'eyebrow: "#2f8f5e"'`.
- [x] 3.3 Add `FLOW_COLORS.eyebrow = "#267a50"` with its contrast comment; `PageEyebrow` uses it.
      `leafDark` and its other users stay untouched.

## 4. Check

- [x] 4.1 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, and
      `pnpm exec vitest run` over the touched test files pass. Groups 1–3 are disjoint in files;
      group 2 depends on group 1.
