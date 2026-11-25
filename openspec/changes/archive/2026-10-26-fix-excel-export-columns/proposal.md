## Why

The Excel files users download from "Polygon validation" and "Deforestation analysis" put most values under the wrong headers. The headers come from the current upload template:

`…, Unit, Region, Coordinates format, Geometry type, Land coordinates, Area, …`

The rows are still written in an older order:

`…, Unit, Country, Region, Coordinates, Area, …`

So from the sixth column on, every value is shifted:
- the country sits under "Region";
- the region sits under "Coordinates format";
- the coordinates sit under "Geometry type", and so on.

The overlap percentage is merged in a column that holds a document link.

The files look like the upload template, but they can't be uploaded again:
- the coordinates have no format or geometry type;
- the deforestation export has 2 header rows instead of the template's 3, so its first farm would be read as the example row;
- a decimal production quantity is written as text with a dot (`"1200.5"`), which a Spanish upload rejects.

## What Changes

- Both Excel exports write each farm in the upload template's columns, in its order:
  - the coordinates format is `GeoJSON`;
  - the geometry type is `Point` or `Polygon`;
  - the coordinates are a GeoJSON coordinates array;
  - the country column, which the template no longer has, is dropped;
  - result columns (validation status, inconsistency type and overlap percentage, deforestation per layer) come after the template's columns.
- Both exports keep the template's 3 header rows, so the example row is never a farm.
- Production quantity and area are written as numbers, not text, so they read the same in any language.
- The overlap percentage is merged in its own column.
- The building of both exports moves out of the page components into a tested util. A test uploads each export again and gets the same farms back.

## Capabilities

### New Capabilities
- `results-export`: the Excel exports of the validation and deforestation results: their columns, their header rows, and that they can be uploaded again.

### Modified Capabilities
<!-- None: no existing spec covers the Excel exports. -->

## Impact

- **Web:**
  - `src/utils/download.ts` (`getRowCommonDataAsArray`);
  - `src/utils/excel.ts` (`loadTemplateHeaders`, `SheetData`);
  - `src/components/page/polygonsValidation/DownloadPageData.tsx` and `src/components/page/deforestationAnalysis/DownloadPageData.tsx`;
  - a new util with its Vitest tests.
- **API:** none.
- **Users:**
  - the Excel exports change layout: values move under their right headers;
  - the country column disappears (every farm has the selected country);
  - coordinates are written as GeoJSON instead of `[(lng,lat), …]`.
- **CHANGELOG:** "Fixed" for the Excel exports.

### Out of scope
- **The deforestation columns' headers.** They are always in Spanish ("Deforestación según …"), even in an English export.
- **The production date.** It is written as the API returns it.
- **The GeoJSON export.** It is not affected.
