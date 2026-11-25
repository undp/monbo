## Why

The stage pages moved to the v2 look (blue accents, ink texts, hairlines, sentence-case buttons, round cards), but the drawing modal they open still has MUI's default look: uppercase buttons, a plain title, gray dividers and a form that blends with the map. The product owner asked for it to follow the new styles.

## What Changes

- **Heading:** an icon tile, the title in the heading font and a subtitle ("Draw the farm on the satellite map and fill in its production data"), over a hairline; the close button in the stage pages' muted color.
- **Two areas:** the map and its tools on the left; the farm's fields in a light-blue side panel on the right that runs the content's height (under the map on a phone). The panel's groups ("Production data", "Optional") get uppercase labels, as the "how to" panel's, and each document becomes a small card with its remove button.
- **Toolbar:** polygon/point becomes a segmented control with icons; the actions are sentence-case buttons of one height (so the map still doesn't move), with icons for delete and start over, and "Start over" at the row's end.
- **Under the map:** the instructions sit in a tinted hint box; the coordinates get a "Go to coordinates" label; the vertex list uses the stage pages' table look, compact.
- **Footer:** a hairline over it; the missing-drawing hint with an info icon; "Cancel" quiet and "Add" in the flow's blue.
- **"How to draw" dialog:** the same heading and the steps in two columns with the stage pages' chevrons. Its GIFs are recorded again from the new modal (`scripts/record-drawing-gif.mjs`, which also opens the modal through the drawing method now).
- **Texts:** new keys for the subtitles and the coordinates label; the mandatory group's title becomes "Datos de producción" / "Production data".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `manual-farm-entry`: "A farm can be added manually" adds the modal's layout: heading with subtitle, map on the left, fields in a side panel, actions in a footer, sentence-case buttons.

## Impact

- **Web** (`apps/web/src/components/page/uploadData/manualFarm/`): `ManualFarmModal.tsx`, `DrawingToolbar.tsx`, `CoordinatesInput.tsx`, `DrawingCoordinates.tsx`, `ManualFarmFields.tsx`, `HowToDraw.tsx`, and the new `ModalHeader.tsx` and `manualFarmStyles.ts`. Locales `es`/`en` `manualFarm.json`. `public/images/manual-farm-drawing-{es,en}.gif` and `scripts/record-drawing-gif.mjs`.
- No behavior, API or contract change: the same controls, names and validation.
- **Archive order:** after `stage-one-unified-table`, which has the latest "A farm can be added manually".
