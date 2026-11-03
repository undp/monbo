## Context

Today the upload step of both modules is one drop zone for the Excel template. Dropping the file runs `loadExcelFileFarmsData` in the browser and sends its rows straight to `/farms/parse` (`performFarmsGeneration`). The results page opens when the farms come back.

Two prototypes were built and shown to the client. Both are uncommitted worktrees, rebased on `dev` after #86 and #87.
- **A:** geo file with fixed attribute names. It adds a single drop zone, `geoFile.ts`, a `geoAttributeMappings` table and a help panel.
- **B:** geo file + Excel joined by ID. It adds `geoFileJoin.ts`, `farmsUpload.ts`, two drop zones (`FarmsUploadStep.tsx`) and a parameterized `loadExcelFileFarmsData`.

Both prototypes carry their own `POST /farms/import`. The two are almost the same; they differ in error-code style (kebab vs snake) and in KML id handling. Since #86, `/farms/parse` accepts holes and MultiPolygons, and both prototypes pass MultiPolygons through.

The client chose: all three file options, plus drawing a farm by hand. From the questions asked:
- the manual entry is only on the upload step;
- files and manual farms mix in one list;
- the manual entry draws a polygon or a point with its area;
- there is one drop zone, plus an optional Excel per geo file.

## Goals / Non-Goals

**Goals:**
- One upload step that takes any mix of the four sources, shows what will be uploaded, and starts on the user's command.
- One API reader for geo files, the prototypes' merged.
- Reuse the prototypes' tested logic (A's mapping, B's join) instead of rewriting it.
- Drawing that works on today's Google Maps, with no new dependency.

**Non-Goals:**
- Manual entry after an analysis ran.
- Drawing holes or parts.
- Column mapping.
- Persisting the list.

## Decisions

### 1. An upload list of sources

The step keeps a list of sources in its state:

```ts
type UploadSource =
  | { kind: "excel"; id: string; file: File; rows: FarmRow[] }
  | { kind: "geo"; id: string; file: File; features: ImportedFeature[];
      excel?: { file: File; rows: FarmRow[] } }
  | { kind: "manual"; id: string; row: FarmRow };
```

`FarmRow` is what `/farms/parse` takes today (the Excel loader's row).
- A geo source's rows are derived: from its attributes (decision 3), or from the join with its Excel when one is attached (decision 4).
- The list shows each source with its farm count, or the reason it can't be uploaded ("missing data in 3 features"), and a remove action. Manual farms also have an edit action.
- The step's button ("Validate polygons" or "Analyse deforestation", as today's page) concatenates every source's rows in list order and calls the existing `performFarmsGeneration`. The rest of the flow (`/farms/parse`, the validation or the analysis, the results page) doesn't change.
- IDs duplicated across sources are checked in the browser first, so the error can name both sources. `/farms/parse` still checks them as well.

This replaces "process on drop", the one UX change users will notice. B already did it, with its "Upload files" button.

- *Alternative: keep processing on drop for a single Excel.* Rejected. Two behaviours for the same zone, and the manual farms still need a list.

### 2. One API reader, from prototype B, with A's KML fix

`app/modules/farms/geo_import.py` comes from B, whose codes follow the layers admin's style (`snake_case`, like `IngestionError("layer_not_found")`). That makes the codes: `unsupported_format`, `unreadable_file`, `no_shapefile`, `missing_prj`, `no_features`, `archive_too_large` and `file_too_large` for the file, and `empty_geometry` and `unsupported_geometry` for a feature.

Prototype A found that a KML exported by QGIS has an XML `id` on each placemark. GDAL puts that XML id in `id`, and an `id` in the ExtendedData then comes back as `id2`. The reader normalizes this for KML and KMZ: it drops the XML id, and renames `id2` to `id`. The web then has one rule: the ID is `id`/`ID` (ignoring case), else, for KML, the placemark's `Name`. The response says the file's format, so the web knows when `Name` applies.

The limits are B's: 20 MB per upload, 200 MB uncompressed, and `/vsizip/` reading.

### 3. Attributes by fixed names, from prototype A

`geoAttributeMappings` (A) moves next to `headerKeywordsMappings` in `utils/excel.ts`, and `geoFeaturesToFarmRows` (A) builds the rows. A keeps these behaviours:
- an `Area` of 0 counts as missing;
- `"1200.5"` is sent as a number;
- dates are kept as written;
- `ProducerCountry` is checked against the selected country.

A geo source whose rows miss mandatory data isn't uploadable until an Excel is attached or the source is removed. Its errors are shown when it is added, and the list offers "Attach production Excel".

### 4. Join by ID, from prototype B

`geoFileJoin.ts` (B) builds the rows when an Excel is attached. The Excel is read with the parameterized `loadExcelFileFarmsData` (B): with an ID column, and without the coordinate columns. It keeps B's four join errors and its ID rule (trimmed text), with the KML `Name` fallback of decision 2.

### 5. Manual entry with our own drawing tool

Google's Drawing Library (`DrawingManager`) was deprecated in August 2025 and removed in May 2026. `@vis.gl/react-google-maps` has no drawing component; its "Drawing" example builds custom tools from Maps JavaScript API overlays. The modal does the same, on the `google.maps.Map` from `useMap()`:

- **Polygon mode:**
  - each click on the map adds a vertex to a `google.maps.Polygon` drawn as the user goes;
  - "Finish", or a click on the first vertex, closes it;
  - once closed, the polygon is `editable: true`, so Google Maps itself lets the user drag vertices and add vertices at the midpoints;
  - right-clicking a vertex deletes it (the `PolyMouseEvent`'s `vertex`, then `path.removeAt`), keeping at least 3.
- **Crossing edges:** before a vertex is added or moved, a segment-intersection check (`utils/drawing.ts`, tested) rejects a vertex whose edges would cross another edge. A moved vertex that would cross goes back to where it was.
- **Point mode:** a click places a `google.maps.Circle` of the radius that the area field gives, and dragging moves it.
- **"Start over"** clears the drawing. A toggle picks polygon or point.
- **Map:** satellite. It opens on the selected country's bounding box, from a static `countryBounds.json` (ISO alpha-2 to `[west, south, east, north]`, generated once from Natural Earth's public-domain admin-0 boundaries, about 10 KB). The latitude and longitude field pans and zooms there.
- **Form:** the template's fields, mandatory ones marked. A point also needs its area. "Add" runs `validateData` on the one row, so the messages are the template's, and marks the fields it names.
- **Row:** `coordinatesFormat: "GeoJSON"`, `geometryType` `Polygon` or `Point`, and `farmCoordinates` as the GeoJSON coordinates (a closed ring). These are the shapes `/farms/parse` takes from the Excel today, so nothing new reaches the API.
- **Editing:** opening a manual farm loads its geometry as an editable polygon or point, and its data into the form.

The geometry logic lives in plain, tested functions; the component only wires Google Maps events to them:
- adding, moving and deleting a vertex;
- the crossing check;
- closing the ring;
- converting to and from the row.

- *Alternative: Terra Draw* (`terra-draw` and its Google Maps adapter, MIT). It has an official vis.gl example and includes the crossing validation and touch support. Not chosen: our own tool needs no dependency, follows vis.gl's own "Drawing" example, and Google Maps already does the vertex editing.
- *Alternative: MapLibre with `mapbox-gl-draw`* (react-map-gl's "Draw Polygon" example). Rejected: a second map engine for one modal, and another satellite imagery than the rest of the app.

### 6. Shared by both modules

The step is one component, used by `PolygonsValidationUploadDataPageContent` and `DeforestationAnalysisUploadDataPageContent`. Each page passes its button label and its `performFarmsGeneration`. The deforestation page keeps requiring a selected layer.

### 7. One card per way to upload (client's choice)

After a review of four layouts (cards, tabs, wizard, and a single drop zone with a guide, in `.context/ux-carga-opciones.html`), the client chose cards. The step shows four cards; each says when to use it and what it needs, and gives 3 steps and its own control. All the cards feed the list of decision 1. Consequences:
- **Drop zones take one kind of file each.** `DropZone` gets an `accept` per card, and an `invalidTypeMessage` naming the card that takes the file. The mixed zone goes away.
- **Card 3 joins its pair.** It keeps its geo file and its Excel until both are there, then adds one geo source with the Excel attached (decision 4). "Attach production Excel" stays on a geo source from card 2 that misses data.
- **The template moves into the cards.** Cards 1 and 3 link to their templates, and the pages drop their "download the template" step. Validation becomes one step, and deforestation two: layers, then farms.
- **Option 3 template:** `m1-upload-file-template-geo-{es,en}.xlsx` is the main template without the three coordinate columns, with ID marked mandatory. It is generated by a script from the main one, so the two can't drift.
- **Examples:** `public/files/examples/{es,en}/`. Their farms are in Costa Rica and have no producer country, so they upload under any selected country (outside the country's layers, the analysis gives N/A, which is fine for an example). They are generated by the same script, and a test uploads each one through the real readers.
- **The summary and the actionable messages** come from the sources' data, not from parsing messages. A geo source keeps how many features miss each mandatory attribute; a join keeps how many IDs didn't match.
- **The drawing GIF** (`public/images/manual-farm-drawing-{es,en}.gif`) is recorded from the real modal with Playwright and assembled with Pillow. It is recorded at the map's own width (768 px) and opens large, in a dialog with the written steps, from a "How to draw?" button in the drawing toolbar. A first version showed it as a panel over the map's corner, which covered the map and was too small; the client asked for the button and the larger dialog.

## Risks / Trade-offs

- **[Drawing tool edge cases]** These are ours to get right: a double click that zooms the map instead of finishing, touch devices, a vertex dragged across an edge. → Map double-click zoom is off in the modal, and finishing is an explicit button. The geometry rules are unit-tested. The Playwright check draws, edits and tries a crossing. Touch is checked on a mobile viewport.
- **[A map inside a Dialog]** Google Maps needs its container's size when it mounts. → The modal's map has a fixed height, and it mounts after the Dialog opens.
- **[Users expect drop-to-process]** → The step's button is prominent, and the list says how many farms will be sent. The template step's copy explains the four ways.
- **[A big upload in the list]** The list stores rows only, not geometries on a map, so 1,000 farms in it are cheap. The geo file features are kept to rebuild rows when an Excel is attached or removed.
- **[Country bounds for a country not in the table]** → The map opens on the world, and the coordinates field still works.
- **[Four cards take room, especially on a phone]** → On a narrow screen the cards stack, each one compact (needs, steps, control). The list and the button come right after.
- **[The GIF goes stale when the modal changes]** → The recording script is kept with the examples script, so it can be re-run.

## Migration Plan

API and web together: the endpoint is new, and nothing changes for `/farms/parse`. When merged, the two prototype worktrees are discarded.

## Open Questions

None.
