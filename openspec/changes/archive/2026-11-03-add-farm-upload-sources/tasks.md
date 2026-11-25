## 1. API: `/farms/import`

- [x] 1.1 Port `geo_import.py`, the `/farms/import` route, its models and its tests from prototype B. Keep its `snake_case` codes, its limits and its MultiPolygon pass-through.
- [x] 1.2 KML/KMZ id normalization (decision 2): drop the placemark's XML `id`, rename GDAL's `id2` to `id`, and return the file's format. Tests: a KML exported by GDAL with ExtendedData `id` gives that id, and a Google Earth KMZ (name only) gives no `id` and keeps `Name`.

  GDAL turned out to depend on how the KML is written. An untyped ExtendedData `id` (Google Earth, QGIS) lands in `id`; GDAL's typed schema puts it in `id2` and the XML id in `id`; with only an XML id, `id` gets it. The reader therefore reads the placemarks' XML ids, and drops an `id` equal to one of them. The answer is `{format, features}`.
- [x] 1.3 `pnpm contracts`. API `pytest`, `ruff`, `black` and `mypy` pass.

## 2. Web: reading the sources

- [x] 2.1 Port from prototype A: `geoAttributeMappings` (into `utils/excel.ts`) and `geoFeaturesToFarmRows`, with their tests, adapted to the API's `snake_case` codes and the ID rule of decision 2.
- [x] 2.2 Port from prototype B: `geoFileJoin.ts` and the parameterized `loadExcelFileFarmsData`, with their tests, using the same ID rule.
- [x] 2.3 `utils/uploadSources.ts`:
  - the `UploadSource` model, and each source's rows or errors;
  - the concatenated rows, and the cross-source duplicate IDs, naming both sources.

  Unit tests cover:
  - every source kind;
  - a geo source with and without an attached Excel;
  - an Excel without coordinates rejected with its hint;
  - duplicates across sources.

## 3. Web: the upload step

- [x] 3.1 The shared `FarmsUploadStep` has (the list lives in `useUploadSources`, in the page, so it survives the loading screen when `/farms/parse` rejects the upload):
  - one drop zone (Excel and geo formats);
  - the list of sources, with the count or the reason, and remove;
  - "Attach production Excel" on a geo source;
  - the step's button, which concatenates and calls the page's `performFarmsGeneration`.

  The geo file fields help comes from A.
- [x] 3.2 Use it in both upload pages. Keep the deforestation page's layer requirement. Update the template step copy, explaining the four ways, in es and en.
- [x] 3.3 Errors through `notifyUploadErrors`, prefixed with their source (file name, or "Manual farm F-…").

## 4. Web: manual entry

- [x] 4.1 `utils/drawing.ts`, plain functions with Vitest tests:
  - adding a vertex, moving one and deleting one (keeping at least 3);
  - the segment-intersection check that rejects a crossing;
  - closing the ring;
  - converting a polygon or a point to a farm row and back.
- [x] 4.2 `countryBounds.json` generated once from Natural Earth admin-0 (public domain), with the script that made it in `apps/web/scripts/`. The map opens on the selected country.
- [x] 4.3 `ManualFarmModal`, wiring Google Maps events to `utils/drawing.ts`:
  - satellite map, with double-click zoom off;
  - polygon mode: clicks add vertices, "Finish" or a click on the first vertex closes the polygon, which is then `editable`, and right-click deletes a vertex;
  - point mode: a draggable circle of the area's radius;
  - polygon/point toggle;
  - "Start over";
  - lat/lng "Go";
  - the template's fields, and area for points;
  - `validateData` on "Add", marking the fields;
  - edit mode that loads a listed farm.

  Add the "Add manually" button to the step. Copy in es and en.

  Done in `ManualFarmModal.tsx`, with the form logic in `ManualFarmModalForm.ts` and the map wiring in `DrawingMap.tsx`. The copy is in a `manualFarm` namespace, registered in `utils/i18n.ts`.

  Additions beyond the design:
  - Touch has no right-click: a click selects a vertex, and "Borrar vértice" deletes it.
  - Fields show short messages ("Dato obligatorio") instead of the template's, which name a row. The whole row still goes through `validateData`.
  - Numbers follow the API's locale rules, so "2.5" is rejected in Spanish.

  Edit mode loads GeoJSON points and single-ring polygons. Any other row keeps its data and asks the user to redraw.
- [x] 4.4 Tests:
  - the row built from a drawn polygon and from a point;
  - field validation;
  - editing replaces the farm.

  These are unit tests on the modal's logic; the map interaction is checked in 5.1.

## 5. Verify

- [x] 5.1 In the app, with Playwright and the Google Maps key:
  - a mix of an Excel, a KMZ with an attached Excel, a Shapefile `.zip`, Monbo's GeoJSON download, and two manual farms (a polygon and a point) is validated and analysed together;
  - the error paths: a KMZ without data, a mismatching ID, a duplicate across sources, a drawn crossing;
  - drawing, a vertex drag and a vertex delete, also on a mobile viewport.

  Save screenshots in `.context/`.

  Done with Playwright and Google Maps (`.context/e2e/upload_sources.js`, screenshots in `.context/e2e/screenshots/`). A list was validated together:
  - an Excel (5 farms);
  - a Google Earth KMZ (names only) with its Excel attached (5);
  - a Shapefile `.zip` (5);
  - Monbo's GeoJSON download (5);
  - a drawn polygon and a drawn point of 2,5 ha.

  That is 22 farms. Editing a drawn farm kept its data. In the deforestation module, an Excel plus a drawn point (6 farms) was analysed with GFW.

  The error paths worked: a KMZ without data is listed as "Faltan datos" and offers the Excel; mismatching IDs give a row without geometry and a feature without a row; the same Excel dropped twice gives duplicate IDs naming both sources; and a crossing vertex is rejected on a 390 px viewport.

  This run found that duplicates were compared by source name, so the same file twice wasn't caught. They are now compared by source, with a test.
- [x] 5.2 Web `lint`, type-check and `test` pass. The API suite passes.

## 6. Docs

- [x] 6.1 `docs/architecture.md`: how farms come in (the four sources, `/farms/import`, the list).
- [x] 6.2 CHANGELOG "Added": the four ways and `/farms/import`. "Changed": the upload starts with the button, not on drop.

## 7. Cards layout and the client's improvements

- [x] 7.1 Generator script (`apps/web/scripts/generate-upload-examples.py`) for:
  - the option 3 templates `m1-upload-file-template-geo-{es,en}.xlsx`, from the main ones: without the coordinate columns, ID mandatory;
  - the examples in `public/files/examples/{es,en}/`:
    - option 1: a filled Excel;
    - option 2: a GeoJSON and a Shapefile `.zip`;
    - option 3: a KML whose names are IDs, and its Excel.

  A Vitest test uploads every example through the real readers, without errors.
- [x] 7.2 The drawing GIFs `public/images/manual-farm-drawing-{es,en}.gif`, recorded from the modal (Playwright + Pillow), with their script.
- [x] 7.3 `FarmsUploadStep` as four cards:
  - a drop zone per kind, with `invalidTypeMessage`;
  - card 3 joins its pair;
  - template and example links;
  - the fields help opened from card 2.

  The pages drop the template step and renumber. es/en copy.
- [x] 7.4 List summary (farms, polygons, points, sources with problems), and each source's first problem in the list.
- [x] 7.5 Actionable messages: the missing attributes of a geo file with their counts and the option 3 hint; join mismatches with the ID rule; duplicates across sources with "remove or fix one". Unit tests.
- [x] 7.6 The GIF in `ManualFarmModal`, in a collapsible "How to draw" panel, open until drawing starts.

  Changed after the client saw it: it is a "¿Cómo dibujar?" button (info icon) in the drawing toolbar, which opens a dialog with the GIF at 768 px and the 4 steps written out. The GIFs were re-recorded at that width (about 382 KB each).
- [x] 7.7 Verify again: unit tests, lint, type-check, and Playwright over the cards (each card's upload, the wrong-card message, card 3's pair, the examples, the summary), with screenshots.

  Playwright (`.context/e2e/cards.js`, screenshots in `.context/e2e/screenshots-cards/`):
  - Every template and example link answers 200.
  - A KML on card 1 gets the card's message, and an Excel without coordinates on card 1 points to option 3.
  - The examples went through cards 1 and 2. The option 3 KML went on card 2, was listed with its missing fields, and got its Excel attached.
  - A KMZ and its Excel went through card 3, which waited for the Excel. The modal opened with its GIF.
  - The summary read "25 fincas: 20 polígonos y 5 puntos", and the 25 farms validated with no inconsistencies.
