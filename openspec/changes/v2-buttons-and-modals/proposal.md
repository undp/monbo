## Why

A review of the web after the v2 redesign found that every button not styled by hand still has MUI's default look (uppercase, square-ish, a shadow on contained ones): "VALIDAR POLÍGONOS", "ANALIZAR", "CAMBIAR CAPAS", "GENERAR VISTA PREVIA", "DESCARGAR", "CERRAR", "INGRESAR". Most modals also keep the old look: a plain title, MUI's table and uppercase actions. Only the drawing modal got the v2 heading (`manual-farm-modal-v2`).

## What Changes

- **Buttons in the theme:** `config/theme.ts` gives every MUI button the v2 look: sentence case, 10 px corners, no shadow, weight 600; a contained primary in the flow's blue (`#0d64a0`, darker on hover); an outlined primary blue on white with a 1.74:1 border; a text primary in blue. Buttons styled with `sx` keep their own look.
- **One modal heading:** `ModalHeader` moves from the drawing modal to `components/reusable/Modals/` with an optional icon, a tone for the icon tile (blue, amber for a warning, red for an error), an optional subtitle and an optional close button. Only the title names the dialog. `modalStyles.ts` holds the paper (16 px corners), the padding and a footer of actions over a hairline.
- **`BaseModal`** uses them, with `subtitle`, `icon`, `tone` and an `actions` footer. Its modals follow: "Formato" (the report's download, its buttons in the footer), the answer modals (`ActionModal`: the restart warning when changing country, with an amber tile, and the start page's "same data or new data"), and the admin's example of a layer's texts.
- **`BasePolygonModal`** uses the heading and the stage pages' compact table in a framed panel; the farm detail gets the polygon or point icon, the overlaps modal an amber tile and the geometry error modal a red one.
- **"Detalles de las capas"** (stage 2) and **"Nombres de atributos aceptados"** (the geographic file's help) get the heading; the layers are pills (the chosen one blue) and the attribute table the compact stage table.
- `flowTable.ts` adds `FLOW_TABLE_COMPACT_SX`, now also used by the drawing modal's vertex list.

## Capabilities

### New Capabilities

- `interface-style`: the look every button and modal of the web shares.

### Modified Capabilities

None.

## Impact

- **Web** (`apps/web/src/`): `config/theme.ts`; `components/reusable/BaseModal.tsx`, `Modals/ModalHeader.tsx` (moved from `uploadData/manualFarm/`), `Modals/modalStyles.ts`, `Modals/ActionModal.tsx`, `Modals/RestartAnalysisModal.tsx`; `page/polygonsValidation/{BasePolygonModal,PolygonDetailModal,FarmOverlapsModal,GeometryInconsistencyModal}.tsx`; `page/territorialAnalysis/MapsDetailsModal.tsx`; `page/uploadData/GeoFileFieldsHelp.tsx`; `page/reportGeneration/DownloadFormatModal.tsx`; `page/admin/LayerTextsExampleModal.tsx`; `page/flow/flowTable.ts`; the drawing modal's imports.
- No texts, API or contract change. The header's country button also loses its uppercase.
- Not in this change: the snackbars, the ZIP progress, the loading screen, the download icon button, the map's controls, the admin's login and the methodology page's body.
