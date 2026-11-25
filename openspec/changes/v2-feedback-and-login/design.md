## Context

`v2-buttons-and-modals` moved the buttons (theme) and the modals (`ModalHeader`, `BaseModal`) to the v2 look. What is left are pieces each built once with MUI's defaults: `SnackbarContext`, `LoadingScreen`, `ZipProgress`, `DownloadButton`, `Map`'s controls and the admin login. The stage pages' tokens are `FLOW_COLORS`, `STAGE_CARD`, `HEADING_FONT` and `stagePageBackground` (`flow/flowStyles.ts`).

## Goals / Non-Goals

**Goals:** these pieces read as v2; every icon-only control has an accessible name.

**Non-Goals:** the methodology page; a theme override for `MuiAlert` or `MuiOutlinedInput` (both appear in screens with their own styles; a later, wider change).

## Decisions

### D1: Snackbars as white cards

A filled alert in the type's color is the loudest element on a stage page. A white card with a colored left edge and icon keeps the type readable (the icon has at least 3:1 on white) and matches the stage pages' result pills. MUI's `Alert` stays, with `variant="outlined"` and `sx`, so its role and close button don't change.

### D2: The loading card fits under the flow header

The old screen was `100vh - 64px` tall, which under the flow header overflowed the window. The card now takes a stage page's body width and at least 360 px, centered; `RuntimeConfigGate` (before any page) shows the same card. In a 1366×768 viewport the flow header ends about 236 px from the top (the app header included), so the card ends at about 236 + 32 + 360 + 32 = 660 px. A 768 px screen with the browser's bars leaves less than 768 px of viewport, which is why the requirement speaks of the viewport.

### D6: One height for the stage pages' heading actions

"Cambiar capas" and "Descargar" sit side by side on stage 2. `PAGE_ACTION_HEIGHT` (40 px, the small search field's height) gives both the same height.

### D3: A labeled download button

The square icon had no name for screen readers and didn't say what it does. "Descargar" with an arrow tells it opens a menu, and matches "Cambiar capas" beside it on stage 2. It needs `common:download`.

### D4: Named map controls

`Map.tsx`'s three controls were `Button`s with only an icon. They become `IconButton`s with `aria-label` (`common:mapControls`), on white cards with an ink icon (blue on hover), as Google Maps' own controls look over the map.

### D5: The shared field style leaves the drawing modal

The login needs the v2 field. `FIELD` moves to `components/reusable/inputs/fieldStyles.ts` instead of the login importing from `uploadData/manualFarm/`.

## Risks / Trade-offs

- [A test or caller relied on the deleted components] → None import them (checked by name across `src/`); the suite passes.
- [The ZIP progress is not seen in the screenshots] → It needs a report above the large-report threshold; its change is styling only, and its texts and role are unchanged.

## Migration Plan

None: a web-only change, deployed with the next merge into `dev`.
