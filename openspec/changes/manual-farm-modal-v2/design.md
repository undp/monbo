## Context

The drawing modal (`uploadData/manualFarm/`) predates the v2 mockup. The stage pages share their look through `flow/flowStyles.ts` (`FLOW_COLORS`, `HEADING_FONT`, `STAGE_CARD`) and `flow/flowTable.ts`; the app theme (`config/theme.ts`) has no component overrides, so each v2 screen styles its MUI controls with `sx`.

## Goals / Non-Goals

**Goals:** the modal and its "How to draw" dialog read as part of the stage pages; nothing the user does in them changes.

**Non-Goals:** new controls, a different field order or validation, moving the coordinates above the map, a theme-wide button style.

## Decisions

### D1: Local styles, not theme overrides

The modal's button and field styles live in `manualFarm/manualFarmStyles.ts` (`PRIMARY_BUTTON`, `SECONDARY_BUTTON`, `TEXT_BUTTON`, `FIELD`, `EYEBROW`, `MODAL_PAPER`) and use `FLOW_COLORS`. Overriding `MuiButton` in the theme would restyle every screen, including the ones not yet moved to v2.

*Alternative:* a theme override. Rejected for its reach; it can come when the whole app is on v2.

### D2: A side panel for the fields

The fields move into a right-hand panel with the flow's light blue (`blue25`) and a hairline drawn as an inset shadow, so it takes no width. The panel is 384 px with 24 px padding: the fields keep about the old width and the map stays 768 px wide, the width the "How to draw" GIFs are recorded at.

### D3: One height for the toolbar's actions

The toolbar keeps its two rows from the start so the map never moves. Framed and unframed buttons differ by their border, so every action gets `height: 32`. Without it, closing a polygon moved the map by 2 px, which also made every GIF frame after it differ entirely (2 MB instead of about 0.5 MB).

### D4: Record the GIFs again

The spec says the animation is recorded from the modal itself, so it is recorded again with the new look. The recording script opened the modal with the old "Add manually" button, gone since `stage-one-unified-table`; it now clicks the "Draw on the map" method and its area. The GIF is 768×545 (was 768×542), and `HowToDraw.tsx` declares the new size.

## Risks / Trade-offs

- [The GIF's single palette turns the toolbar's blue text dark] → It already did; the animation is about the map, and the buttons stay legible.
- [Contrast] → Texts use `ink`/`ink2`/`muted` on white or `blue25` (at least 4.5:1); field borders keep about the old contrast.

## Migration Plan

None: a web-only change, deployed with the next merge into `dev`.
