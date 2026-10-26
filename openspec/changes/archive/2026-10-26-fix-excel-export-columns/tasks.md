## 1. Failing tests first

- [x] 1.1 `utils/resultsExport.test.ts`, for `es` and `en`:
  - build the validation export for a polygon farm (production 1200.5) and a point farm (2.5 ha), write it with `generateExcel`, and read it back with `loadExcelFileFarmsData`: no errors, and the same farms;
  - the deforestation export's first farm is on row 4;
  - each result header sits right after the template's columns;
  - the overlap percentage merge is in the "Overlap Percentage" column.

  Written next to the fix. Run against the old row builder (old columns, 2-row deforestation header, merge in column 17), the 10 export tests fail; with the fix, all 12 pass.

## 2. Fix

- [x] 2.1 `utils/excel.ts`: `TEMPLATE_COLUMNS` (the template's internal keys in order). `SheetData` rows accept numbers. A test checks that `TEMPLATE_COLUMNS` matches the real templates' row 2 in both languages.
- [x] 2.2 `utils/resultsExport.ts`:
  - `farmToTemplateRow` (GeoJSON coordinates, geometry type, numeric quantity and area, no country);
  - template header rows cut to `TEMPLATE_COLUMNS.length`;
  - `buildPolygonValidationSheets` and `buildDeforestationSheets`, moved from the components, with the third header row kept and the merge column computed.
- [x] 2.3 Both `DownloadPageData.tsx` call the util. Remove `getRowCommonDataAsArray` if nothing else uses it.

## 3. Verify

- [x] 3.1 `pnpm --dir apps/web lint`, type-check and `test` pass.
- [x] 3.2 In the running app, export both Excel files in Spanish and English. Open them and check the values sit under their headers. Upload the validation export again and get the same farms.

  Done with Playwright on 5 Costa Rica farms (F-001 with 1200.5 kg):
  - the validation export, in `es` and `en`, uploaded again with "Datos analizados correctamente" / "Data analized successfully";
  - the deforestation export (GFW 2020-2023), uploaded again with all 5 farms;
  - every value under its header, with quantity and area as numeric cells.
- [x] 3.3 CHANGELOG: a "Fixed" entry for the Excel exports.
