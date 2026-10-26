## Context

Both export pages build their sheets inside the component (`parseData` in each `DownloadPageData.tsx`):

- **Headers:** `loadTemplateHeaders` returns the upload template's first 3 rows (headers, mandatory flags and the example row).
- **Rows:** each farm is written by `getRowCommonDataAsArray`, whose column order predates the current template. It has a country column, which the template no longer has. It lacks the coordinates format and geometry type columns.

Nothing checks the two orders against each other, so they drifted apart. The template's example row also has a stray value in column S, beyond its 18 headers.

## Goals / Non-Goals

**Goals:**
- Each value under its header, in both exports and both languages.
- An export can be uploaded again and gives the same farms.
- A test fails if the template's columns and the export's columns drift apart again.

**Non-Goals:**
- Translating the deforestation columns' headers.
- Formatting dates.
- Changing the GeoJSON export.

## Decisions

### The template's column order lives in one list

`TEMPLATE_COLUMNS` in `utils/excel.ts` lists the template's internal keys in order: `id`, `producerName`, …, `documentUrl3`. These are the same keys `headerKeywordsMappings` maps the headers to. A farm's row is built by key (`farmToTemplateRow`), then laid out with `TEMPLATE_COLUMNS`. Result columns start at `TEMPLATE_COLUMNS.length`. Merges and extra headers use that index instead of a hard-coded `17`.

- *Alternative: read the order from the template file at export time.* Rejected. The export would depend on matching the header text again, and a mismatch would fail at download time instead of in a test.

### Header rows are cut to the template's width

The 3 rows from `loadTemplateHeaders` are padded or cut to `TEMPLATE_COLUMNS.length` before the result headers are appended, so the example row's stray value in column S doesn't push a result header out of line. The deforestation export keeps the third row (the example row), which it used to drop. Its result cells on that row stay empty.

### Coordinates as GeoJSON, numbers as numbers

- **Coordinates:**
  - the coordinates format is `GeoJSON`;
  - the coordinates are `JSON.stringify` of `[lng, lat]` for a point, or `[ring]` for a polygon.
  It is one of the template's two formats, and the one the GeoJSON export and the EUDR use.
- **Numbers:**
  - production quantity is written as a number;
  - area as a number of hectares with 2 decimals.
  A numeric cell reaches the API as a number, which `parse_float_string` returns as is. A text cell would be parsed with the language's separator, and `"1200.5"` fails in Spanish. `SheetData` rows accept numbers, and ExcelJS writes them as numeric cells.
- **The country column is dropped.** The template no longer has it, and every farm has the selected country.

### Sheet building moves to a util

`utils/resultsExport.ts` exports `buildPolygonValidationSheets` and `buildDeforestationSheets`, moved from the two components unchanged apart from the fixes. The components call them. This makes the round trip testable without rendering pages: build the sheets, write them with `generateExcel`, read them with `loadExcelFileFarmsData`, and compare.

## Risks / Trade-offs

- **[Someone relies on the old, shifted layout]** → It was wrong under its own headers, so a script that relied on it was reading mislabelled data. A CHANGELOG "Fixed" entry describes the new layout.
- **[An empty polygon (no details)]** → Its coordinates cell is empty and its geometry type is `Polygon`. Uploading it again fails as invalid coordinates, as the farm itself was invalid.
- **[Area rounded to 2 decimals]** → A point uploaded again gets the area within 0.01 ha, so its radius changes by less than the rounding. The area of a polygon is ignored on upload.
