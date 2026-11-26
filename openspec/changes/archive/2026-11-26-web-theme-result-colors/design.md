## Context

Result colors today (all opened 2026-11-26):

| Where | Literal | Use |
|---|---|---|
| `utils/styling.ts:8-18` | `#2E7D32`, `#D32F2F`, `#676767`; backgrounds `alpha(…, 0.08)` and `#D5D5D5` | ok / flagged / unknown, text and background; read by `utils/report/sections.tsx:15,136,139` (PDF), `SelectedPolygonsMap.tsx`, `ResultChip.tsx` |
| `CategorySummaryCards.tsx:17-21` | `#f2b8b2`, `#c7d3df` (+ `FLOW_COLORS.ok`) | meter segments, used at `:157` |
| `NoObservationsCounterChip.tsx:30-31` | `#D5D5D5`, `#676767` | no-data chip (same values as styling's unknown) |
| `MapView.tsx:20-21`, used `:250` | `TILE_COLOR = "#ff0000"` | legend swatch of the layer's tiles |
| `ResultChip.tsx:5` | `#eef2f6` | neutral chip background |

The theme (`config/theme.ts:39-46`) already augments MUI's `Palette`/`PaletteOptions` with
`landing`. `PageEyebrow.tsx:15` uses `FLOW_COLORS.leafDark` (`flowStyles.ts:10`, `#2f8f5e`), the
same token as several icons (`HowToSteps.tsx:65`, `TextHeaderStepContainer.tsx:48`,
`SECTION_ICON_TILE` at `flowStyles.ts:86`, `AdminSidebar.tsx:93`, …). `PageEyebrow` renders on
white, on `FLOW_COLORS.pageBackground` and on `blue25` (users: `DocumentationMarkdown.tsx:50`,
`CategoryPreview.tsx:138`, `AdminLoginPageContent.tsx:105`, `AdminPageContainer.tsx:87`,
`StageEyebrow.tsx:13`).

Test renders (`src/test/renderWithData.tsx`) don't wrap a `ThemeProvider`; `config/theme.test.tsx`
does, and reads colors with `getComputedStyle` (works in jsdom with emotion).

## Goals / Non-Goals

**Goals:** one definition of each result color, in the theme; identical rendered values; AA
eyebrow. **Non-Goals:** see proposal.

## Decisions

1. **`palette.result` in the theme, backed by an exported constant.** In `config/theme.ts`, export
   `RESULT_COLORS` (plain object) and set `palette.result = RESULT_COLORS`, with the interface
   added to both `Palette` and `PaletteOptions`. Keys:
   `ok "#2E7D32"`, `okBackground alpha("#2E7D32", 0.08)`, `flagged "#D32F2F"`,
   `flaggedBackground alpha("#D32F2F", 0.08)`, `unknown "#676767"`, `unknownBackground "#D5D5D5"`,
   `meterFlagged "#f2b8b2"`, `meterUnknown "#c7d3df"`, `neutralBackground "#eef2f6"`,
   `layerTile "#ff0000"`.
   - `utils/styling.ts` builds `RESULT_CLASS_COLORS` / `RESULT_CLASS_BACKGROUND_COLORS` from
     `RESULT_COLORS` (import, not `useTheme`): the PDF (`@react-pdf`) has no MUI theme context.
   - Rejected: a separate `config/resultColors.ts` — the issue asks for the theme, and the
     constant living in `theme.ts` keeps one file.
2. **Components read through `sx` palette paths** (`backgroundColor: "result.unknownBackground"`,
   `color: "result.unknown"`), not `useTheme()`. MUI resolves palette paths in `sx`; without a
   `ThemeProvider` (most unit-test renders) the path degrades to an inert string instead of
   throwing on `undefined.result`. `ResultChip` keeps its existing `useTheme()` for
   `landing.inkSecondary` and uses the path for `neutralBackground`.
   - `CategorySummaryCards`: `METER_COLORS` becomes `ok: FLOW_COLORS.ok` (unchanged),
     `flagged: "result.meterFlagged"`, `unknown: "result.meterUnknown"`.
   - `MapView`: delete `TILE_COLOR`; the swatch uses `"result.layerTile"`, keeping the comment
     that the API paints the tiles red.
3. **Eyebrow token.** Add `FLOW_COLORS.eyebrow = "#267a50"` with a comment stating its contrast
   (5.27:1 white, 4.98:1 `blue25`, 5.01:1 page background, 4.82:1 mint) and use it only in
   `PageEyebrow`. `leafDark` stays for icons. Rejected: darkening `leafDark` — would change every
   icon, outside "no visual change".
4. **Contrast helper for tests** in `src/test/contrast.ts` (WCAG relative luminance), used by the
   eyebrow test. Test-only; no runtime use.

API contract / data shape / cross-stack wiring: N/A — web styling only.
Signal tracing: N/A — no signal.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `config/theme.ts` | A palette key typed in `Palette` but not `PaletteOptions` fails `tsc` | augmentation at `theme.ts:39-46` |
| `utils/styling.ts` | Any value drift changes the PDF report's chips (no visual change allowed) | consumers `utils/report/sections.tsx:136,139` |
| `CategorySummaryCards.tsx` | `FLOW_COLORS.ok` (`#2e9e5b`) ≠ styling's ok (`#2E7D32`); unifying them would be a visual change | `CategorySummaryCards.tsx:18`, `flowStyles.ts:40` |
| `NoObservationsCounterChip.tsx` | Same as above; must keep `#D5D5D5`/`#676767` exactly | `:30-31` |
| `MapView.tsx` | MB-6 (#178, merged) touched `LayerTilesOverlay.tsx`, not this file; no conflict | `git log` 2026-11-26 |
| `ResultChip.tsx` | `useTheme().palette.landing` throws without a provider when `kind="neutral"` | `ResultChip.tsx:15-18` |
| `flowStyles.ts`, `PageEyebrow.tsx` | Changing `leafDark` would alter icons | usages listed in Context |

## Risks / Trade-offs

- [MUI palette-path resolution in `sx` for a custom group] → the theme test asserts a component
  rendered in the real theme gets the exact rgb; if MUI doesn't resolve the path the test is red.
