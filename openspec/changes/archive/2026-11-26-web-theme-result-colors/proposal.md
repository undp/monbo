## Why

Result colors are scattered as hex literals in components, so the theme (`config/theme.ts`) is
not the single place to read or change them, and the page eyebrow fails WCAG AA: `PageEyebrow`
paints 12 px text in `#2f8f5e`, 4.03:1 on white and 3.80:1 on `blue25`, under the 4.5:1 AA asks.
Follow-ups of GC-4 (#120) and the review of #145, tracked in #168 (MB-8 of #172).

## What Changes

- New theme palette group `result` holding every result color the web paints: the ok / flagged /
  no-data text and background colors (today `utils/styling.ts`), the summary meter's flagged and
  no-data segments (`CategorySummaryCards.tsx`), the neutral chip background (`ResultChip.tsx`),
  and the layer tile color of the map legend (`MapView.tsx`).
- `utils/styling.ts`, `CategorySummaryCards`, `NoObservationsCounterChip`, `MapView` and
  `ResultChip` read those colors from the theme. Every value stays the same: no visual change,
  in the app or in the PDF.
- `PageEyebrow` uses a new darker green, `#267a50` (5.27:1 on white, 4.98:1 on `blue25`). Icons
  that use `FLOW_COLORS.leafDark` keep it (they need 3:1 and have it).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `interface-style`: adds requirements that result colors come from the theme and that the page
  eyebrow meets AA contrast.

## Impact

- Web only: `config/theme.ts`, `utils/styling.ts`, `components/page/flow/flowStyles.ts`,
  `components/page/flow/PageEyebrow.tsx`, `components/reusable/ResultChip.tsx`,
  `components/page/territorialAnalysis/{CategorySummaryCards,NoObservationsCounterChip,MapView}.tsx`
  and their tests.
- No API, contract or i18n change.

## Non-goals

- Changing any color value other than the eyebrow's.
- Moving `FLOW_COLORS` (the flow's chrome colors) or category colors into the theme.
- The API's tile color (the tiles are painted red server-side); only the web legend's swatch moves.
