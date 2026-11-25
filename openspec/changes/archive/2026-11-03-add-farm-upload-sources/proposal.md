## Why

Today the only way to give Monbo the farms is the Excel template, with each polygon written as text in a cell (WKT or a GeoJSON array). Users who have their farms in a GIS file have to convert every polygon to text by hand. Those files are an EUDR GeoJSON, a Shapefile from a cooperative's technical team, or a KMZ from Google Earth or a field GPS app. A user with one or two farms and no file has no way in at all.

The client saw two prototypes:
- **A:** a geo file whose attributes carry each farm's data, under fixed names.
- **B:** a geo file whose IDs join an Excel with the production data.

The client decided to keep both, alongside today's Excel, and to add a fourth way: drawing a farm on a map and filling in its data, one farm at a time. #86 already made holes and MultiPolygons work end to end, so any of these sources can carry them.

## What Changes

- **One list of farms to upload.** The upload step builds a list from any mix of sources. The user reviews it, can remove a source or a farm, and then starts the validation or the analysis with a button. **BREAKING (UX):** dropping a file no longer starts the processing at once.
- **One card per way to upload** (the client's choice among four layouts). Each card says when to use it and what it needs, and gives its steps, its own upload control and example files. The four ways:
  1. **Excel with coordinates in a cell**, as today.
  2. **Geo file with fixed attribute names.** Each feature is a farm, and its data comes from its attributes. The accepted names are the EUDR ones (`ProducerName`, `Area`, `ProducerCountry`), those of Monbo's own GeoJSON download (which can be uploaded again as is), short names for Shapefiles (`PRODUCTOR`, `FECHA_PROD`, …) and the template's headers. A help panel lists them.
  3. **Geo file + Excel joined by ID.** Card 3 takes both files. Its Excel has its own template, without coordinate columns, where the ID is mandatory. The geometry comes from the file and the data from the Excel, matched by farm ID (a KML placemark's name counts as its ID). A geo file from card 2 that misses data can also get its Excel attached from the list.
- **The list says what will be uploaded:** how many farms, polygons and points, and which sources have problems. Each problem says what to do about it.
- **Add a farm manually** (option 4). The modal shows a short animation of how to draw. A button opens a modal with a map and the farm's fields. The user draws the farm's polygon, or places a point and gives its area, fills in the data and adds it to the list. A farm drawn this way can be edited or removed before the upload.
- **API: `POST /farms/import`**, from the prototypes. It reads a geo file with GDAL (already in the image through pyogrio), reprojects it to EPSG:4326 and drops Z. It returns each feature's attributes and its geometry as WKT: Point, Polygon, or MultiPolygon with its holes. File and feature problems come back as error codes that the web translates.
- **Drawing on Google Maps, with our own tool.** Google's Drawing Library, the usual way, was removed in May 2026. `@vis.gl/react-google-maps` has no drawing component; its own "Drawing" example builds the tools from Maps JavaScript API overlays. The modal does the same: clicks add vertices, and an editable `google.maps.Polygon` lets the user drag them. No new dependency.

## Capabilities

### New Capabilities
- `geo-file-import`: how the API reads a geo file (formats, coordinate systems, limits, geometry types) and reports its problems.
- `manual-farm-entry`: drawing a farm on a map and entering its data, to add it to the upload.

### Modified Capabilities
- `farm-upload`: the upload is a list built from several sources (Excel, geo file, geo file with an Excel joined by ID, manual farms), started by the user. Errors are still summarized as today, and now name their source.

## Impact

- **API:**
  - new `app/modules/farms/geo_import.py` and `POST /farms/import` in `app/modules/farms/router.py`;
  - models in `app/models/farms.py`;
  - tests in `tests/modules/farms/`;
  - `openapi.json` regenerated.
- **Web:**
  - the upload step of "Polygon validation" and "Deforestation analysis" (shared code);
  - a new upload list, a geo file reader (attribute mapping and the Excel join), and the manual entry modal on top of `components/reusable/Map.tsx`;
  - `utils/excel.ts` (mandatory headers by source);
  - `api/farms.ts`, `config/env.ts` and the es/en locales;
  - `schema.d.ts` regenerated.
- **Dependencies:** none.
- **Files:**
  - the option 3 template `m1-upload-file-template-geo-{es,en}.xlsx`;
  - example files per option in `public/files/examples/`;
  - the drawing GIFs in `public/images/`;
  - the script that generates the templates and examples, in `apps/web/scripts/`.
- **Docs:** `docs/architecture.md` (how farms come in), the cards' copy, the CHANGELOG.
- **Prototypes:** the two prototype worktrees (A and B) are the source of the API reader and of both mappings. They are discarded once this change is merged.

### Out of scope
- Adding farms to an analysis that already ran: the manual entry is only on the upload step.
- Drawing holes or several parts by hand. Files can carry them; the manual modal draws one polygon or one point.
- Column mapping (choosing which attribute is which).
- Saving the list between visits: it lives in the page, like the rest of the analysis.
