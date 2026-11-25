## Why

After `v2-buttons-and-modals`, the review of the web still found pieces in MUI's default look: the green filled snackbars, the gray loading screen with a 120 px spinner, the report's ZIP progress, a square download button with no text, the farm detail map's blue square controls, and the admin's login page. The download button and the map controls are also icon-only buttons with no accessible name. Three components (`Footer`, `NavigationButton`, `SingleSelector`) are imported nowhere.

## What Changes

- **Snackbars:** a white card with the type's color on the icon and a 4 px left edge (green, blue, amber, red from `FLOW_COLORS`), ink text and a soft shadow, instead of MUI's filled alert.
- **Loading screen:** a stage card as wide as a stage page's body (`FLOW_CONTENT_MAX_WIDTH`), at least 360 px tall, with a 56 px blue spinner and the text in `ink2`. It is a `status` region, so the wait is announced.
- **ZIP progress:** the stage card's look, the title in the heading font, the ring in blue on a `blue50` track and the percentage in the heading font.
- **Download button** (stages 1 and 2): an outlined button "Descargar" with a download icon and an arrow, instead of a square icon; it and "Cambiar capas" share `PAGE_ACTION_HEIGHT` (40 px). It is named by its text; its menu ids come from `useId`.
- **Map controls** (farm detail and the other modals on `Map.tsx`): white cards with an ink icon, as Google Maps draws its own, named "Centrar el mapa", "Acercar" and "Alejar".
- **Admin login:** the stage pages' background and card, a lock tile, the "Administración" eyebrow, the title in the heading font, the v2 field and a full-width "Ingresar".
- **Shared field style:** `FIELD` moves from the drawing modal's styles to `components/reusable/inputs/fieldStyles.ts`, used by the drawing modal and the login.
- **Dead code:** `components/reusable/Footer.tsx`, `NavigationButton.tsx` and `selectors/SingleSelector.tsx` are deleted.
- **Other icon-only buttons:** the search field's clear button ("Borrar la búsqueda") and the geometry error modal's row toggle ("Detalles de la finca <id>", with `aria-expanded`) get a name, so none is left without one.
- **Texts:** `common:download`, `common:clearSearch`, `common:mapControls` (`center`, `zoomIn`, `zoomOut`) and `polygonValidation:geometryInconsistencyModal.farmDetails` in `es` and `en`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `interface-style` (added by `v2-buttons-and-modals`): two requirements are added, for the feedback and waits, and for naming icon-only controls.

## Impact

- **Web** (`apps/web/src/`): `context/SnackbarContext.tsx`; `components/reusable/{LoadingScreen,DownloadButton,Map}.tsx`; `components/reusable/inputs/fieldStyles.ts` (new); `components/page/reportGeneration/ZipProgress.tsx`; `components/page/admin/AdminLoginPageContent.tsx`; the drawing modal's imports; locales `common.json`; three deleted components.
- No API or contract change.
- **Archive order:** after `v2-buttons-and-modals`, which creates `interface-style`.
- Not in this change: the methodology page's body.
