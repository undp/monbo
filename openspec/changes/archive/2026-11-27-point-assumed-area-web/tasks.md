Groups 1, 2 and 3 write disjoint files, except the shared fixtures of group 4, which runs last.

## 1. Report: the assumed-area note

Files: apps/web/src/utils/report/sections.tsx, apps/web/src/locales/es/reportGeneration.json, apps/web/src/locales/en/reportGeneration.json, apps/web/src/utils/report.test.tsx

- [x] 1.1 In `utils/report.test.tsx` (describe "a farm's sheet"), add first (fix tripwires, red pre-change): a point farm with `area: 40000, areaAssumed: true` shows "Área supuesta: 4 ha, no declarada" in Spanish and "Assumed area: 4 ha, not declared" in English; a point with `areaAssumed: false` and a polygon farm show neither. Minimal mutant: in `sections.tsx`, `--find "farm.polygon.areaAssumed" --replace "false"` turns the assumed tests red.
- [x] 1.2 Add the `assumedArea` key to `farmSheet` in both `reportGeneration.json` files, in its own block (EUDR-10).
- [x] 1.3 `sections.tsx`: optional `note` on `DataItem`, rendered under the value with an existing style; pass it for an assumed point under "Superficie total (ha)", the hectares formatted without trailing zeros.

## 2. Exports leave an assumed area out

Files: apps/web/src/utils/download.ts, apps/web/src/utils/resultsExport.ts, apps/web/src/utils/geojson.test.ts, apps/web/src/utils/resultsExport.test.ts

- [x] 2.1 Tests first (fix tripwires): in `geojson.test.ts` ("the Area of a GeoJSON feature"), a point with `areaAssumed: true` has no `Area` key, one with `areaAssumed: false` and 25,000 m² has `Area: 2.5`; in `resultsExport.test.ts`, a template row of an assumed point has an empty area cell. Minimal mutant: in `download.ts`, replace the `farm.polygon.areaAssumed` operand of the new condition with `false` (`--find "farm.polygon.areaAssumed" --replace "false"`, which must match exactly once in that file).
- [x] 2.2 `download.ts`: `areaHectares` returns `null` for a point whose `areaAssumed` is true; update its doc comment.
- [x] 2.3 `resultsExport.ts:70-72`: fix the comment (4 ha default; an assumed area is written empty).

## 3. Manual form preview

Files: apps/web/src/components/page/uploadData/manualFarm/ManualFarmModal.tsx, apps/web/src/components/page/uploadData/manualFarm/ManualFarmModal.test.tsx

- [x] 3.1 Test first (fix tripwire): after placing a point and before typing an area, `map().radius` is `112.84`; the existing "adds a point with its area" test keeps `89.21` after typing 2,5. Minimal mutant: `--find "DEFAULT_POINT_AREA_HECTARES = 4" --replace "DEFAULT_POINT_AREA_HECTARES = 1"`.
- [x] 3.2 `ManualFarmModal.tsx`: `DEFAULT_POINT_AREA_HECTARES = 4`, comment: the API's default for a point without an area (`FarmDefaults.DEFAULT_POINT_AREA_HECTARES`).

## 4. Fixtures and checks

Files: apps/web/src/test/factories.ts, apps/web/src/**/*.test.ts, apps/web/src/**/*.test.tsx

- [x] 4.1 Add `areaAssumed: false` to the point in `test/factories.ts` and to every other point `FarmData` literal `pnpm exec tsc --noEmit` reports. No behaviour change in those tests.
- [ ] 4.2 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` green (includes `src/locales/locales.test.ts`).
