## Context

The stage 1 redesign of `progressive-flow-stages` (GC-10, not committed yet) brought the upload page close to the Etapa 1 screen of mockup v2. Three gaps remain, and the user decided how to close them on 2026-11-18.

**Results.** The results page still shows two tabs, each with its own table:
- `ValidFarmsTable` lists the farms that are not `NOT_VALID`;
- `InconsistentFarmsTable` has one row per farm per inconsistency, with rowSpan.

The API reports overlaps **pairwise** (`get_overlap_inconsistencies`), so a farm with two neighbours appears in two inconsistencies. Manual validation exists only in `OverlapInconsistencyModal`, which shows one pair and one checkbox per farm of the pair. That checkbox flips the farm's status in `polygonsValidationResults.farmResults`, so it applies to all of the farm's pairs. `GeometryInconsistencyModal` is informational.

**The upload list.** It is page-local state (`useUploadSources`) and has one item per source. Sources are an Excel, a geo file with or without an Excel, or a manual farm. The problems and actions belong to the source.

The upload page also has an effect that validates whenever `farmsData` changes, including on mount. So opening it with farms loaded validates them at once and redirects to the results. Stage 2 relies on this: farms uploaded there are validated when the user opens stage 1.

**Origin.** `/farms/parse` drops fields it doesn't know, and fills in missing IDs:
- when no farm has an ID, it numbers them 1, 2, 3 and so on;
- when only some do, it gives the others **random** 6-character IDs (`ensure_farm_ids`).

So the parsed farms can't be joined back to their sources by ID.

The user's decisions:
- a single table with Estado;
- for a farm with several neighbours, a modal that lists all its pairs;
- geometry errors stay informational;
- no "Nombre" column;
- Producción before the validation, and Producción and Área after it;
- the origin returned by the API;
- "Agregar más polígonos" goes back to the kept list (option A), and a manual validation is kept only when the farm's neighbours are the same.

## Goals / Non-Goals

**Goals:**
- The results page and the upload list match mockup v2, within the data we have.
- "Agregar más polígonos" never leaves a farm validated over an overlap the user didn't see.
- The origin survives the API without the web guessing it.

**Non-Goals:**
- Changing how the API detects overlaps or geometry errors.
- Keeping stage 2's upload list in memory.
- Computing areas in the browser.
- Keeping state across a refresh. The flow is dropped on refresh by design.
- Changing the Excel or GeoJSON exports.

## Decisions

### 1. `origin` is an optional, echoed field of the parse contract

`InputFarmData` gets `origin: FarmOrigin | None = None`, and `FarmData` gets `origin: FarmOrigin | None`. The field is required in the OpenAPI through `json_schema_serialization_defaults_required`.

`FarmOrigin` holds:
- `method`: `Literal["excel", "geoFile", "geoFileWithExcel", "manual"]`;
- `fileName`: `str | None`, at most 255 characters.

`PreProcessedFarmData` carries it, and `parse_base_information` copies it. The model, `openapi.json` and `schema.d.ts` go in one commit (`pnpm contracts`).

The web sets the origin per row when it builds the upload (`collectUpload`), from the row's source. It is not a column of the template. The results read `farm.origin`.

- **Alternative: tag in the browser and join by position.** `/farms/parse` keeps the order, so this would work. It needs no API change. But it couples the web to the parser's order, which nothing promises, and the user asked for the API to return it.
- **Alternative: join by ID.** It breaks for rows without an ID, whose IDs the API makes up, sometimes at random.
- **Privacy.** A file name is user content. It is echoed in the response and never stored or logged. `note_usage` keeps receiving counts only. This matches the invariant that no farm data is kept on the server.

### 2. One results table, built from a per-farm view of the results

A pure helper turns `farmsData` and `polygonsValidationResults` into one view per farm. It is unit-tested on its own. Each view has:
- the farm;
- its status;
- its geometry inconsistency, if any;
- its overlaps, each one with the neighbour's ID, area, percentage, criticality and the overlap's parts.

The table, `ValidationResultsTable`, renders the views with the reusable `Table`. It keeps the page's search, the farm detail on a row click, and `RESULTS_SECTION_HEIGHT` with an inner scroll. The status follows the priority of the spec: geometry error, then manual validation, then overlap, then ready.

The page drops `Tabs` and `TabTitle`. Its other pieces are kept:
- `ValidationKpis`;
- `DownloadPageData`;
- the search bar;
- the footer.

`ValidFarmsTable`, `InconsistentFarmsTable` and `PolygonInconsistencyModal` are deleted.

### 3. One overlap modal per farm

`FarmOverlapsModal` replaces `OverlapInconsistencyModal`. It takes the farm's view and builds on `BasePolygonModal`:
- the map draws the farm, each neighbour and each overlap's parts;
- a list has one line per neighbour;
- one checkbox validates the farm.

The checkbox changes only the modal's farm. Today's modal has a checkbox for each farm of the pair, but a per-farm modal opened from that farm's row makes it clear what is being validated, and the neighbours keep their own "Revisar". The status flip and its snackbar move from `toggleSelectedRows` to a small helper that the modal calls.

- **Alternative: open the first pair in today's modal.** It is less work, but it hides the farm's other overlaps, while the checkbox validates the farm over all of them. The user chose the full list.

### 4. Removed rows are kept per source, by position

Each file source gets `removedRows: number[]`, the positions in its rows that the user deleted. It is per source because each source has its own rows: an Excel's rows, or an attached Excel's rows.

- Attaching or detaching an Excel resets `removedRows`, since the rows change.
- `sourceRows` filters them out.
- `rereadSources` keeps the field, since reading the same file again gives the same rows in the same order.
- A source whose rows are all removed is removed from the list.
- A manual farm's delete button removes the source, as today.

- **Alternative: key by ID.** Rows without an ID have none until the API parses them, and two rows can share an ID before `collectUpload` rejects the duplicate.

The flat list's rows are built from `sources × sourceRows`, with the source's key and the row's position as the React key and the delete target. The notices per source reuse `sourceErrors`, `canAttachExcel` and the current "Ver errores" dialog.

### 5. The stage 1 list lives in `DataContext`

The sources move from `useState` in `useUploadSources` into `useKeptState`, under a new key `stageOneUploadSources`. `useUploadSources` reads and writes them through the context:
- the stage 1 page reads the kept list;
- stage 2 keeps a local list, through a parameter of the hook.

A `File` stays in memory, as the rest of the kept state does.

The kept list is cleared:
- by `resetAnalysis` ("start over" and "upload new data");
- by a stage 2 upload, which already drops the validation results;
- by a refresh, since the kept state lives in memory.

The validate-on-mount effect changes to:
- **with a kept list:** don't validate until the button is pressed;
- **without a kept list, with farms and no validation results:** validate on entry, as today. This keeps the stage 2 path.

### 6. Re-validation keeps manual validations only for the same neighbours

Before sending the new upload, the page keeps a snapshot. It maps each `VALID_MANUALLY` farm's ID to the set of neighbour IDs it overlapped then.

After `validatePolygons` answers, a pure function, `reconcileManualValidations(snapshot, newResults)`, sets a farm back to `VALID_MANUALLY` when:
- its ID is in the snapshot;
- it has no geometry inconsistency;
- its new set of neighbours equals the old one.

The function returns the reconciled results and how many validations were dropped. A count above zero shows a warning snackbar.

The stage 2 results are dropped through the existing invalidation, the same as a new upload.

- **Alternative: drop every manual validation.** It is simpler, but it throws away a review that is still right.
- **Alternative: keep them all.** It can keep a farm validated over a new overlap nobody saw.

### 7. The drawing area is one button

The drawing panel becomes a `ButtonBase`. It covers the forest image, the icon, the text and a decorative "Abrir mapa" label. It opens `ManualFarmModal`. Its accessible name is the text. It has a visible focus ring. There is no nested button inside.

## Risks / Trade-offs

- **[Farms without an ID lose their manual validation on a re-validation.]** When only some farms have IDs, the API gives the others random IDs on each parse. → They are counted in the "dropped" notice, so the user knows. This is the safe direction: a validation can be lost, never wrongly kept.
- **[A large Excel becomes thousands of rows in the list.]** → The list scrolls inside a fixed-height section, as the results do. If it proves slow with real files, virtualize the rows in a follow-up. The reusable `Table` has no virtualization today.
- **[Two open changes touch stage 1.]** → This change starts after `progressive-flow-stages` is committed. Its delta specs modify `farm-upload` requirements that `progressive-flow-stages` doesn't, so archiving both in order doesn't conflict.
- **[A contract change touches both CI jobs.]** → The model, `openapi.json` and `schema.d.ts` go in one commit. The API test covers the echo and the 255-character limit (a 422).
- **[Keeping `File` objects in memory.]** They are already kept for the country change. Now they also survive a visit to the results. → Memory is released on start over and on refresh.

## Migration Plan

There is no data migration, since nothing is stored. Older web clients don't send `origin` and get it back as null. A rollback reverts the web and the API together, and the contract stays backward compatible.

## Open Questions

None. The user settled the decisions on 2026-11-18.
