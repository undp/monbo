## 1. Modal

- [x] 1.1 `manualFarmStyles.ts` and `ModalHeader.tsx`: the shared button, field and label styles, and the heading with icon, subtitle and close button; only the title names the dialog, the subtitle describes it (D5)
- [x] 1.2 `ManualFarmModal`: the heading, the map column, the fields' side panel, the hint box and the footer
- [x] 1.3 `DrawingToolbar`: the segmented polygon/point switch and the sentence-case actions, all 32 px high
- [x] 1.4 `CoordinatesInput`: the "Go to coordinates" label; on a phone, both fields on one row and the buttons on the next
- [x] 1.5 `DrawingCoordinates`: the stage pages' table look, compact
- [x] 1.6 `ManualFarmFields`: the two labeled groups and the document cards
- [x] 1.7 Locales: `addSubtitle`, `editSubtitle`, `goTo.title`, and "Datos de producción" / "Production data"
- [x] 1.8 `FLOW_COLORS`: the modal's and the upload methods' colors as tokens, with no hex values in the components

## 2. How to draw

- [x] 2.1 `HowToDraw`: the same heading, and the steps in two columns
- [x] 2.2 `record-drawing-gif.mjs` opens the modal through the drawing method; GIFs recorded again (es, en) and their size updated

## 3. Verification

- [x] 3.1 `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build` in `apps/web`
- [x] 3.2 `openspec validate manual-farm-modal-v2 --strict`
- [x] 3.3 Screenshots at 1440×900, 1366×768 and 390 px: empty, with a polygon and scrolled down; and the "How to draw" dialog
- [x] 3.4 The modal by hand: draw a polygon with a hole and a part, a point with its area, edit a listed farm, and the "How to draw" dialog
- [x] 3.5 Tests: each dialog is named by its title alone, and the modal is described by its subtitle
