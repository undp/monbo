## 1. Buttons

- [x] 1.1 `config/theme.ts`: `MuiButton` overrides (sentence case, corners, weight, no shadow; primary contained, outlined and text colors from `palette.landing`)

## 2. Modals

- [x] 2.1 `ModalHeader` to `components/reusable/Modals/`, with optional icon, `tone`, optional close button and a node title; `modalStyles.ts` (paper, padding, footer)
- [x] 2.2 `BaseModal`: the heading, `subtitle`, `icon`, `tone` and an `actions` footer
- [x] 2.3 `ActionModal` (answers in the footer), `RestartAnalysisModal` (amber tile), "Formato" (downloads in the footer), `LayerTextsExampleModal` (icon, compact table)
- [x] 2.4 `BasePolygonModal`: the heading and the compact table in a framed panel; icons and tones for the detail, overlaps and geometry error modals
- [x] 2.5 `MapsDetailsModal`: the heading and the layers as a radio group of pills, with their own focus style
- [x] 2.6 `GeoFileFieldsHelp` on `BaseModal`, with the compact table, closed from the heading's X only
- [x] 2.7 `FLOW_TABLE_COMPACT_SX` in `flowTable.ts`, also for the drawing modal's vertex list
- [x] 2.8 Review fixes: `BasePolygonModal`'s footer in `MODAL_FOOTER`; `ActionModal`'s question as the dialog's description (`describedById`); `fieldLine` in `palette.landing`; the theme's tests in `config/theme.test.tsx`

## 3. Verification

- [x] 3.1 `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build` in `apps/web`
- [x] 3.2 `openspec validate v2-buttons-and-modals --strict`
- [x] 3.3 Screenshots at 1440×900: the upload page, the layers page, stage 2's results, the report page, and the farm detail, "Detalles de las capas", "Nombres de atributos aceptados", "Formato" and the restart modal
- [x] 3.4 By hand in the browser: the same screens, plus the overlaps and geometry error modals (with data that has them) and the admin's example modal
