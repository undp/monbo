## Why

Stage 1 still differs from the Etapa 1 screen of mockup v2 in the parts that matter most. The results are split into two tabs, so a user has to switch tabs to see which farms are ready and which need a look. The upload list shows files instead of polygons. Adding polygons after a validation means starting over. The mockup shows one table with a status per polygon, a list of polygons with their producer and crop, and an "Agregar más polígonos" link. Closing this gap now, while the stage 1 redesign (`progressive-flow-stages`, GC-10) is still open, avoids shipping a screen we already know we'll change.

## What Changes

- **One results table instead of the two tabs.** There is one row per farm, with the columns ID, Productor, Cultivo, Producción, Área, Tipo, Origen and Estado. The mockup's "Nombre" column is omitted, because the farm data has no name.
- **The Estado column and its "Revisar" button.** The states are:
  - "Listo";
  - "Validado manualmente";
  - "Se superpone con X (área)", or "Se superpone con N polígonos";
  - the geometry error.

  "Revisar" on an overlap opens a new modal with **all of that farm's overlaps**: a map, the list of its neighbours, and the checkbox that validates the farm manually. A geometry error keeps its current informational modal and can't be validated manually.
- **"Agregar más polígonos".** The results page links back to the upload page with the earlier list still there. Submitting parses and validates every farm again.
  - A farm validated manually **stays validated only if it overlaps exactly the same farms as before**. Otherwise it goes back to "Revisar".
  - Any stage 2 results are dropped.
- **The upload list shows one row per polygon or point.** The columns are ID, Productor, Cultivo, Producción, Tipo and Origen. Each row has a delete button (a trash can), and a drawn farm keeps its edit button.
  - The problems and actions that belong to a file, such as missing data, "Ver errores", "Adjuntar Excel" or removing the file, move to a notice per file above the rows.
  - Producción appears before the validation and Área after it, because the area is computed by the API.
- **The upload list is kept in the flow's browser state** (`DataContext`), so it survives the visit to the results. A refresh still drops it, as with the rest of the flow.
- **The whole "Dibuja un polígono o marca un punto en el mapa" area opens the drawing modal**, by mouse and by keyboard.
- **API: each farm carries its origin.** `POST /farms/parse` accepts an optional `origin` per farm, with the upload method and the file name, and returns it unchanged in `FarmData`. Nothing is stored on the server, and the usage events don't carry it.
- **BREAKING (web only):** the "Válidos" and "Con inconsistencias" tabs, `ValidFarmsTable`, `InconsistentFarmsTable` and the pairwise `OverlapInconsistencyModal` are removed from the results page. The Excel and GeoJSON exports keep their current content.

## Capabilities

### New Capabilities

- `validation-results`: the stage 1 results page. It covers the single table and its states, "Revisar" and the overlap modal per farm, manual validation, "Agregar más polígonos" and how manual validations survive a new validation.

### Modified Capabilities

- `farm-upload`:
  - the list becomes one row per farm, with a delete button, and problems shown per file;
  - the summary requirement now refers to that notice;
  - the list is kept while the user visits the results;
  - a new requirement: each farm keeps its origin through `/farms/parse`.
- `manual-farm-entry`: the drawing method's whole area opens the modal, replacing the "Add manually" button.

## Impact

- **API (`apps/api`):**
  - `app/models/farms.py`: a `FarmOrigin` model, an optional `origin` in `InputFarmData`, and `origin` in `FarmData`.
  - `app/modules/farms/validations.py` and `helpers.py`: carry `origin` through.
  - Tests in `tests/modules/farms/`.
  - `openapi.json` and `apps/web/src/api/schema.d.ts`, regenerated with `pnpm contracts`.
- **Web, upload (`apps/web/src`):**
  - `context/DataContext.tsx`: the kept upload list, cleared by `resetAnalysis` and by a stage 2 upload.
  - `components/page/uploadData/` (`FarmsUploadStep`, `useUploadSources`, the source utilities): the rows per farm, the removed rows per source, the origin, and the notices per file.
  - `PolygonsValidationUploadDataPageContent.tsx`: no automatic validation when the kept list is shown, and reconciling the manual validations.
- **Web, results (`apps/web/src`):**
  - `app/[locale]/polygons-validation/page.tsx`: the table replaces the tabs.
  - `components/page/polygonsValidation/`: the new table and overlap modal; `TabTitle`, `ValidFarmsTable`, `InconsistentFarmsTable`, `PolygonInconsistencyModal` and `OverlapInconsistencyModal` are removed.
  - Locales `es` and `en`.
- **Stage 2:** its upload page uses the same list component, so it also shows one row per farm. It keeps its own list, which this change doesn't keep in memory.
- **Docs:** `docs/onboarding.md` and `content/documentation/{es,en}/` (upload and validation results).
- **Order:** `progressive-flow-stages` (GC-10) is archived before this change. This change builds on its stage 1 pages, which are not committed yet.
