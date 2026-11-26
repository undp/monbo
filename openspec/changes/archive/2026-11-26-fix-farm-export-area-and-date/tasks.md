Order: second change of the batch (issue #185, export data). Groups 1 and 2 are disjoint.
Mutants run with `node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file <file> --find <find> --replace <replace> --test <test>`
on the post-change tree, against the code prescribed in `design.md`. Each **fix tripwire** is
seen red on the pre-change tree first.

## 1. Exports

Files: apps/web/src/utils/dates.ts, apps/web/src/utils/download.ts, apps/web/src/utils/resultsExport.ts, apps/web/src/utils/geoFile.ts

- [x] 1.1 Add `calendarDay` to `dates.ts` (design D2).
- [x] 1.2 In `download.ts`, add `areaHectares` and write `...(area !== null ? { Area: area } : {}),`
  after `ProducerCountry`; write `productionDate: farm.productionDate ? calendarDay(farm.productionDate) : "",`;
  change the return type to `Record<string, string | number>`; drop the TODO (design D1, D2).
- [x] 1.3 In `resultsExport.ts` `farmToTemplateRow`, write the same `productionDate` expression
  and `area: areaHectares(farm) ?? ""`, keeping the comment about hectares (D1, D2).
- [x] 1.4 In `geoFile.ts`, reword the comment above the `"0"` check (D3); the code stays.

## 2. Tests

Files: apps/web/src/utils/dates.test.ts, apps/web/src/utils/geojson.test.ts, apps/web/src/utils/resultsExport.test.ts, apps/web/src/utils/geoFile.test.ts

- [x] 2.1 `dates.test.ts`, inside `describe.each(TIME_ZONES)`:
  - **Fix tripwire:** `calendarDay(new Date(2025, 0, 15).toISOString())`,
    `calendarDay("2025-01-15")` and `calendarDay("2025-01-15T00:00:00")` are `"2025-01-15"`;
    `calendarDay("15/01/2025")` is `"15/01/2025"`. Red pre-change because `calendarDay` doesn't
    exist (an import error counts as red). Mutant: `--file apps/web/src/utils/dates.ts --find "return isValid(dateObject) ? format(dateObject, \"yyyy-MM-dd\") : date;" --replace "return date;"`.
- [x] 2.2 `geojson.test.ts` (`generateGeoJsonFeature`):
  - **Fix tripwire:** a point farm with `area: 25000` has `properties.Area === 2.5` (a number),
    and a polygon farm with `area: 67074.88` has `6.707488` (use `toBeCloseTo` for the float).
    Mutant: `--file apps/web/src/utils/download.ts --find "{ Area: area }" --replace "{ Area: \"0\" }"`.
  - **Fix tripwire:** farms with `area: -1` and `area: null` have no `Area` property. Mutant:
    `--file apps/web/src/utils/download.ts --find "...(area !== null ? { Area: area } : {})," --replace "Area: area,"`.
  - **Fix tripwire**, inside `describe.each(TIME_ZONES)` with `inTimeZone`: a farm whose
    `productionDate` is `new Date(2025, 0, 15).toISOString()` (built inside the test) has
    `properties.productionDate === "2025-01-15"`; `"15/01/2025"` stays as written. Mutant:
    `--file apps/web/src/utils/download.ts --find "farm.productionDate ? calendarDay(farm.productionDate) : \"\"" --replace "farm.productionDate || \"\""`.
- [x] 2.3 `resultsExport.test.ts`:
  - **Fix tripwire**, inside `describe.each(TIME_ZONES)`: `farmToTemplateRow` writes
    `"2025-01-15"` under `productionDate` for a farm stored as
    `new Date(2025, 0, 15).toISOString()`. Mutant: `--file apps/web/src/utils/resultsExport.ts --find "farm.productionDate ? calendarDay(farm.productionDate) : \"\"" --replace "farm.productionDate || \"\""`.
  - Keep the round-trip tests ("uploads the validation export again…", lines 277-293) green:
    build the fixtures' `productionDate` from local fields
    (`new Date(2024, 10, 25).toISOString()`) and expect `"2024-11-25"` in `UPLOADED`. The areas
    they expect (6.71, 2.5, 0.004) don't change (regression guard; mutant:
    `--file apps/web/src/utils/resultsExport.ts --find "area: areaHectares(farm) ?? \"\"," --replace "area: \"\","`).
- [x] 2.4 `geoFile.test.ts`:
  - Update the round trip ("uploads a GeoJSON exported by Monbo again with no edits",
    lines 61-92): the polygon now comes back with `area` 6.707488 (its export's hectares), and the
    expected `productionDate` is the calendar day of the farm's date. Build that date from local
    fields as in 2.3.
  - **Regression guard:** a feature with `"Area": "0"` and one with `"Area": 0` give
    `area: null`. Mutant: `--file apps/web/src/utils/geoFile.ts --find "if (row.area === 0 || row.area === \"0\") row.area = null;" --replace ""`.
- [x] 2.5 Run `pnpm exec vitest run src/utils` and `pnpm exec tsc --noEmit` in `apps/web`.
