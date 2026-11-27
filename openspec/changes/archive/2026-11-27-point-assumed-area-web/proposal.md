## Why

With `point-default-area-4ha` the API analyses a point without an area as 4 ha and says so in `polygon.areaAssumed`. The web still ignores it: the report prints the 4 ha as if the producer had declared them (`apps/web/src/utils/report/sections.tsx:272-276`), the exports write the assumed area as a declared `Area` (`apps/web/src/utils/download.ts:20-37`, `apps/web/src/utils/resultsExport.ts:70-73`), and the manual form previews an undeclared point as 1 ha (`apps/web/src/components/page/uploadData/manualFarm/ManualFarmModal.tsx:52-54,124-127`). An assumed area presented as declared is evidence that says more than what was given (undp/monbo#202).

## What Changes

- The report's farm sheet keeps the 4 ha under "Superficie total (ha)" and adds, below it, "Área supuesta: 4 ha, no declarada" ("Assumed area: 4 ha, not declared") when the point's `areaAssumed` is true.
- The exports (Excel template rows and GeoJSON) leave the area out for a point whose area was assumed, so the file says what the user declared and a re-upload assumes 4 ha again. A declared area is written as today.
- The manual farm form previews a point without a valid area as the 4 ha circle (112.84 m). The area stays mandatory in the form.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-generation`: the farm sheet says when a point's area was assumed.
- `results-export`: exports leave an assumed area out; a re-uploaded point without an area gets 4 ha, not 1 ha.
- `manual-farm-entry`: the point's preview circle is 4 ha until a valid area is typed.

## Impact

- Web: `utils/report/sections.tsx`, `locales/{es,en}/reportGeneration.json`, `utils/download.ts`, `utils/resultsExport.ts` (comment), `components/page/uploadData/manualFarm/ManualFarmModal.tsx`.
- Tests: `utils/report.test.tsx`, `utils/geojson.test.ts`, `utils/resultsExport.test.ts`, `components/page/uploadData/manualFarm/ManualFarmModal.test.tsx`, and every test fixture that builds a point `FarmData` (now needs `areaAssumed`), starting with `test/factories.ts`.
- No API or contract change (it was made in `point-default-area-4ha`).
