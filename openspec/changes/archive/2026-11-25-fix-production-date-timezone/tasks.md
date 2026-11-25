Groups 1-3 are mutually disjoint by file. Group 1 is written first because groups 2 and 3 import its helper. All test commands run from `apps/web`. The mutants' `--find` strings assume the code of design D1 and D2; if Prettier lays the code out differently, keep the same minimal edit and adapt only the literal.

## 1. Read a production date as the uploaded calendar day

Files: apps/web/src/utils/dates.ts, apps/web/src/utils/dates.test.ts, apps/web/src/test/timeZone.ts

- [x] 1.1 Add `apps/web/src/test/timeZone.ts` with `inTimeZone(zone)`, as in design D3: it sets `process.env.TZ` in `beforeEach` and restores the previous value (or deletes the variable) in `afterEach`. Done when `dates.test.ts` uses it and the whole web suite still passes.
- [x] 1.2 Write the fix tripwire first, in `dates.test.ts`: in `describe.each(["America/Bogota", "UTC", "Asia/Tokyo"])` with `inTimeZone`, `shortFormatDateByLanguage("2025-01-15", "es")` is `15-01-2025` and `(…, "en")` is `2025-01-15`. **Fix tripwire**: run `pnpm exec vitest run src/utils/dates.test.ts` before 1.4 and see the `America/Bogota` case red (`14-01-2025`).
- [x] 1.3 In the same `describe.each`, add **regression guards** for the other two inputs, built inside the test after the zone is set: the Excel loader's and the manual form's string, `new Date(2025, 0, 15).toISOString()`, prints `15-01-2025`; a local timestamp `2025-01-15T00:00:00` prints `15-01-2025`; `longFormatDateByLanguage("2025-01-15", "es")` is `15 de enero de 2025`. Green before and after the fix.
- [x] 1.4 Implement design D1 in `apps/web/src/utils/dates.ts`: `DATE_ONLY`, `toCalendarDate` with `parseISO` for a date-only string and `new Date` otherwise, used by both functions. Done when 1.2 and 1.3 pass in the three zones.
- [x] 1.5 Write the second fix tripwire: `shortFormatDateByLanguage("15/01/2025", "es")` returns `15/01/2025` (today it throws `RangeError`). See it red, then implement design D2 (`if (!isValid(dateObject)) return date;`) and see it green.
- [x] 1.6 Falsify the tripwires on the post-change tree with `node "$HOME/.inventures-pipeline/versions/4.3.0/runtime/falsify.mjs" --file apps/web/src/utils/dates.ts --test apps/web/src/utils/dates.test.ts` plus:
  - D1: `--find "? parseISO(date)" --replace "? new Date(date)"` → red;
  - D2: `--find "if (!isValid(dateObject)) return date;" --replace ""` → red.

## 2. The three inputs agree, end to end

Files: apps/web/src/utils/excelTemplates.test.ts, apps/web/src/components/page/uploadData/manualFarm/ManualFarmModalForm.test.ts

- [x] 2.1 In `excelTemplates.test.ts`, add a `describe.each` over the three zones with `inTimeZone`. Load the Spanish template with `filledTemplate("es", edit)` where `edit` writes C4 (a) as a date cell built in the test, `new Date(2025, 0, 15)`, and (b) as a text cell `{ t: "s", v: "2025-01-15" }`, like F01 of `regression_farms.xlsx`. In both cases `shortFormatDateByLanguage(farm.productionDate, "es")` is `15-01-2025`. Case (b) is a **fix tripwire** (red before group 1 in `America/Bogota`); case (a) is a **regression guard**, falsified with `--file apps/web/src/utils/excel.ts --find "newRow.productionDate = dateValue.toISOString();" --replace "newRow.productionDate = dateValue.toISOString().slice(0, 10);" --test apps/web/src/utils/excelTemplates.test.ts` → red in `Asia/Tokyo`. The mutant is temporary: this change doesn't edit `excel.ts`.
- [x] 2.2 Add `ManualFarmModalForm.test.ts` beside `ManualFarmModalForm.ts`: in the three zones, `validateManualFarm` (`ManualFarmModalForm.ts:155`) with `emptyValues()` filled with the mandatory fields, `productionDate: "2025-01-15"` (the date input's value) and a point drawing (`Drawing`, `apps/web/src/utils/drawing.ts:28`) returns a row whose `productionDate` prints `15-01-2025` through `shortFormatDateByLanguage`. **Regression guard**, falsified with `--file apps/web/src/components/page/uploadData/manualFarm/ManualFarmModalForm.ts --find "return new Date(year, month - 1, day).toISOString();" --replace "return new Date(Date.UTC(year, month - 1, day)).toISOString();" --test apps/web/src/components/page/uploadData/manualFarm/ManualFarmModalForm.test.ts` → red in `America/Bogota`.

## 3. The farm sheet of the PDF

Files: apps/web/src/utils/report.test.tsx

- [x] 3.1 In `report.test.tsx`, under "a farm's sheet", with `inTimeZone("America/Bogota")`: a report whose F01 has `productionDate: "2025-01-15"` reads `Fecha de producción 15-01-2025` on its sheet in Spanish and `Production Date 2025-01-15` in English. **Fix tripwire** (red before group 1); falsified by the D1 mutant of 1.6 with `--test apps/web/src/utils/report.test.tsx`.
- [x] 3.2 Same sheet with `productionDate: "15/01/2025"`: the report renders and the sheet reads `Fecha de producción 15/01/2025`. **Fix tripwire** (today the render throws); falsified by the D2 mutant of 1.6 with `--test apps/web/src/utils/report.test.tsx`.

## 4. Checks

- [ ] 4.1 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint` and `pnpm test` pass.
- [x] 4.2 `git diff --stat origin/dev` lists only the files of groups 1-3 and this change's OpenSpec folder. In particular, `apps/web/src/utils/excel.ts` and `apps/web/src/utils/report/sections.tsx` are untouched.
