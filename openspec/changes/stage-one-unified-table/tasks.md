## 0. Prerequisite

- [x] 0.1 Commit the uncommitted stage 1 redesign of `progressive-flow-stages` (§10) after `pnpm run build` passes, so this change starts from a clean base (`fc51b9d`)

## 1. API: farm origin

- [x] 1.1 Add `FarmOrigin` (`method`: `excel` | `geoFile` | `geoFileWithExcel` | `manual`; `fileName`: `str | None`, at most 255 characters) to `app/models/farms.py`. Add an optional `origin` to `InputFarmData` and `PreProcessedFarmData`, and `origin` to `FarmData`, required in the schema
- [x] 1.2 Carry `origin` through `parse_farms_validation` and `parse_base_information`. Check that `note_usage` still receives counts only
- [x] 1.3 Tests in `tests/modules/farms/`:
  - `origin` is echoed per farm;
  - a farm without `origin` gets null;
  - a 256-character `fileName` gets a 422
- [x] 1.4 Run `pnpm contracts` and commit the model, `openapi.json` and `schema.d.ts` together. Run `uv run pytest`, `ruff`, `black --check` and `mypy app`

## 2. Web: upload sources

- [x] 2.1 Add `removedRows` to the file sources in `utils/uploadSources.ts`:
  - `sourceRows` filters the removed rows out;
  - attaching or detaching an Excel resets them;
  - `rereadSources` keeps them
- [x] 2.2 Add `removeRow(sourceKey, index)` to `useUploadSources`. A file source left with no rows is removed
- [x] 2.3 Set each row's `origin` in `collectUpload`, from its source: the method, and the geo file's name for a geo file joined to an Excel
- [x] 2.4 Keep the stage 1 list in `DataContext` (`useKeptState`, key `stageOneUploadSources`). Clear it in `resetAnalysis` and on a stage 2 upload. Let `useUploadSources` take either the kept list or a local one (stage 2)
- [x] 2.5 Unit tests in `utils/uploadSources.test.ts` and `useUploadSources.test.tsx`:
  - removing a row;
  - the removed rows survive a country change;
  - the last row removes the source;
  - the origin per row;
  - the kept list survives an unmount and remount, and is cleared by `resetAnalysis`

## 3. Web: the upload list, one row per farm

- [x] 3.1 Replace the per-source `List` in `FarmsUploadStep` with a table with one row per farm. The columns are ID, Productor, Cultivo, Producción, Tipo and Origen. Each row has a delete button, and manual farms keep their edit button. The table scrolls inside its section
- [x] 3.2 Add one notice per file with problems or file actions above the rows: its first problem, "Ver errores", "Adjuntar Excel" or "Quitar Excel", and "Quitar archivo"
- [x] 3.3 Make the drawing method's whole area one `ButtonBase` that opens `ManualFarmModal`, named by its text and with a visible focus ring
- [x] 3.4 Add the locale keys in `es` and `en` (columns, "Dibujo", "Quitar archivo", the delete button's accessible label). Remove the keys that are no longer used
- [x] 3.5 Update `FarmsUploadStep.test.tsx`:
  - the rows and their columns;
  - deleting a row calls `removeRow`;
  - the notice of a file with problems;
  - the drawing area opens the modal by click and by Enter

## 4. Web: re-validation from the kept list

- [x] 4.1 In `PolygonsValidationUploadDataPageContent`, validate on entry only when no list is kept and there are farms without validation results (the stage 2 path). With a kept list, wait for the button
- [x] 4.2 Add `reconcileManualValidations(snapshot, results)` as a pure helper. It returns the results and the dropped count. Take the snapshot before the upload, apply the helper after `validatePolygons`, and show a warning snackbar when validations were dropped
- [x] 4.3 Make sure the new validation drops the stage 2 results, as a new upload does
- [x] 4.4 Unit tests for `reconcileManualValidations`:
  - same neighbours: kept;
  - a new neighbour: dropped;
  - a deleted neighbour: dropped, and the API's status is taken;
  - a geometry error: dropped;
  - a changed ID: dropped

## 5. Web: results table and overlap modal

- [x] 5.1 Add a pure per-farm view of the results (status, geometry inconsistency, overlaps with neighbour, area, percentage, criticality and parts), with unit tests covering the status priority
- [x] 5.2 Add `ValidationResultsTable`:
  - the columns ID, Productor, Cultivo, Producción, Área ("—" when null), Tipo, Origen ("—" when null) and Estado;
  - the page's search;
  - a row click opens `PolygonDetailModal`;
  - "Revisar" opens the right modal
- [x] 5.3 Add `FarmOverlapsModal` on `BasePolygonModal`: the farm, its neighbours and each overlap on the map, one line per neighbour, and one checkbox that flips only this farm between `NOT_VALID` and `VALID_MANUALLY`, with today's snackbar
- [x] 5.4 Keep `GeometryInconsistencyModal` for geometry errors, without manual validation
- [x] 5.5 Replace the tabs on `app/[locale]/polygons-validation/page.tsx` with the table. Add "Agregar más polígonos", which goes to `/polygons-validation/upload-data` without resetting
- [x] 5.6 Delete `ValidFarmsTable`, `InconsistentFarmsTable`, `PolygonInconsistencyModal`, `OverlapInconsistencyModal`, `TabTitle` and their tests and keys, after checking nothing else imports them
- [x] 5.7 Add the locale keys in `es` and `en`: the columns, the statuses, "Revisar", "Agregar más polígonos", the modal's texts and the dropped-validations notice
- [x] 5.8 Component tests:
  - a single table without tabs;
  - each status, including "Se superpone con 2 polígonos";
  - "Revisar" then the checkbox gives "Validado manualmente";
  - a geometry error opens the modal without a checkbox;
  - "Agregar más polígonos" navigates without resetting

## 5b. Mockup adjustments

- [x] 5b.1 Center a stage page's body at the flow header's width (`FLOW_CONTENT_MAX_WIDTH`), with the upload's bottom bar still spanning the viewport
- [x] 5b.2 Share the mockup's table look between the upload list and the results (`flowTable.ts`): headers on a light band, roomy rows, a blue ID, the type with its icon, and wrapping texts instead of a sideways scroll
- [x] 5b.3 Put the results in a card titled "Resultado de la validación", with the count of items, polygons and points, "Revisar" and "Agregar más polígonos" as links
- [x] 5b.4 Make the summary cards filter the table through `?status=`, with the same rule for their numbers and their rows (`matchesResultsFilter`), plus tests

## 5c. Review fixes (PR #147)

- [x] 5c.1 Reconcile manual validations by geometry, not by ID: a validation never moves to the farm that takes its ID, follows its polygon when the API gives it another ID, and every validated farm still listed that loses it counts in the notice
- [x] 5c.2 Offer "Agregar más polígonos" only over stage 1's own list (farms uploaded on stage 2 have none, and an empty list would replace them)
- [x] 5c.3 Clear the earlier results when new farms are set, so a failed validation never shows a farm as ready
- [x] 5c.4 Ignore a file read that ends after the flow started over
- [x] 5c.5 Name each file notice's buttons after their file; theme colors in the overlaps modal; production through `formatNumber`
- [x] 5c.6 Split `FarmsUploadStep.tsx` into one file per component, and virtualize the upload list from 100 rows (`@tanstack/react-virtual`)
- [x] 5c.7 Let the results card grow with its rows up to the viewport, scrolling from there

## 6. Docs and checks

- [x] 6.1 Update `content/documentation/{es,en}/` (upload and validation results) and `docs/onboarding.md`: the list per farm, the single table, "Revisar" and "Agregar más polígonos"
- [x] 6.2 Run from `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` and `pnpm run build`
- [ ] 6.3 Check by hand in `pnpm dev`:
  - upload, then delete a row, then validate;
  - "Revisar" on a farm with 2 neighbours, validate it, then "Agregar más polígonos";
  - add a farm away from it, and the validation is kept;
  - add one on top of it, and the validation is dropped with the notice
- [x] 6.4 `openspec validate stage-one-unified-table`
