Groups 1 and 2 write disjoint files; groups 3 and 4 write only test files and share some of them. Run the web tests from `apps/web` with `pnpm exec vitest run <path>`.

## 1. Row problems in the producers

Files: apps/web/src/utils/rowProblems.ts, apps/web/src/utils/rowProblems.test.ts, apps/web/src/utils/excel.ts, apps/web/src/utils/excel.test.ts, apps/web/src/utils/geoFile.ts, apps/web/src/utils/geoFile.test.ts

- [x] 1.1 Create `apps/web/src/utils/rowProblems.ts` with `RowProblems`, `NO_ROW_PROBLEMS` (no country, no errors, nothing missing) and `problemMessages`, as design decision 1 shows. Done when it type-checks and has no runtime import of `@/utils/excel`.
- [x] 1.2 In `excel.ts`, export `validateRows` returning one message array per row, and keep `validateData` as `validateRows(params).flat()`. Done when `excel.test.ts` passes unchanged.
- [x] 1.3 In `loadExcelFileFarmsData`, read each row's country before `delete row.country`, always validate every row, and return `rowProblems` (one per row of `data`, each row's other-country message naming only its country, built with the existing `common:parseFileError:otherCountry` key) and `errorMessages: problemMessages(rowProblems)`. Done when the old early return is gone.
- [x] 1.4 In `geoFeaturesToFarmRows`, return `rowProblems` (one per feature: its `featureIssues` messages then its missing-attribute messages in `errors`, its missing keys in `missing`, `otherCountryError([country], …)` in `otherCountry`) and `errorMessages: problemMessages(rowProblems)`. Keep `missing` as the aggregate. Export a per-feature helper if `featureIssues` must be split; keep `featureIssues`' signature for `geoFileJoin.ts`.
- [x] 1.5 Test `rowProblems.test.ts`: `problemMessages` lists each other-country message once and first, then the errors in row order. **Regression guard.** Mutant: `--file apps/web/src/utils/rowProblems.ts --find "  ...problems.flatMap(({ errors }) => errors),\n];" --replace "];"` must turn it red (adapt the literal to the exact final text; the mutant drops the row errors from the list).
- [x] 1.6 Test `excel.test.ts`: `validateRows` returns one array per row, empty for a valid row, aligned with the input even when the first row is valid and the second is not. **Regression guard.** Mutant: `--find "return errorMessages;" --replace "return errorMessages.filter((row) => row.length > 0);"` inside `validateRows` (adapt to the final variable name) must turn it red.
- [x] 1.7 Test `excel.test.ts` (or `uploadSources.test.ts` if it already builds template files): an older-template Excel with rows in Colombia and Peru, Colombia selected, returns the Peru message on the Peru row only, `otherCountry: null` on the other, and still reports the Colombian row's invalid coordinates. **Fix tripwire**: red against the pre-change tree (today only the country message comes back). Mutant: replace the per-row country check with `otherCountry: null` (exact literal from the final code) must turn it red.
- [x] 1.8 Test `geoFile.test.ts`: three features, the second missing the producer name and the third with an API issue: `rowProblems[1].missing` is `["producerName"]`, `rowProblems[2].errors` holds the issue, `rowProblems[0]` has no problems. **Fix tripwire** (pre-change there is no `rowProblems`: red). Mutant: assign every feature's missing keys to the first row (exact literal from the final code) must turn it red.

## 2. Sources keep their rows' problems

Files: apps/web/src/utils/uploadSources.ts

- [x] 2.1 `ExcelSource` gets `rowProblems: RowProblems[]`; `errorMessages` keeps only `[excelWithoutCoordinates]` or `[]`. With no coordinates, `rowProblems` is `data.map(() => NO_ROW_PROBLEMS)`.
- [x] 2.2 `GeoSource` gets `attributeProblems: RowProblems[]` (empty for a rejected file and set in `withAttributeRows`); `attributeErrors` keeps only the API's rejection; `attributeMissing` is removed.
- [x] 2.3 Add `listedProblems(removedRows, problems)` and make `sourceErrors` return the whole-file problems plus `problemMessages` of the listed rows' problems, for an Excel and for a geo file without an Excel. A geo file with an Excel keeps `source.excel.errorMessages`.
- [x] 2.4 Add `sourceMissing(source: GeoSource): MissingAttributes` from the listed features' `missing`, with the keys in `DATA_KEYS` order (export `DATA_KEYS` from `geoFile.ts`, or a helper there, if needed) and the count of listed features missing any. `isMissingData` and `sourceProblem` read it.
- [x] 2.5 `rereadSources` keeps working unchanged: the reread source brings fresh problems for every row and the old `removedRows`. Done when the reread tests of group 3 pass.

## 3. Regression tests of the list

Files: apps/web/src/utils/uploadSources.test.ts, apps/web/src/components/page/uploadData/useUploadSources.test.tsx

- [x] 3.1 `uploadSources.test.ts`, `withoutRow`: an Excel of 3 farms whose second row has malformed coordinates; after `withoutRow(source, 1)` the source has no errors, `isUploadable` is true and `uploadSummary` counts no source with problems. **Fix tripwire** (red pre-change: the file keeps its error). Mutant: `--file apps/web/src/utils/uploadSources.ts --find "problems.filter((_, index) => !removedRows.includes(index))" --replace "problems"` must turn it red.
- [x] 3.2 Same file: deleting a valid row of that Excel keeps the error of the invalid row, still naming row 5. **Regression guard.** Mutant: make `sourceErrors` return only the whole-file problems for an Excel (`--find "...problemMessages(listedProblems(source.removedRows, source.rowProblems))" --replace ""`, exact literal from the final code) must turn it red.
- [x] 3.3 Same file: a GeoJSON of 3 features where only feature 2 lacks the producer name; after deleting its row, `isMissingData` is false, `sourceProblem` is null and the source is uploadable. **Fix tripwire** (red pre-change). Mutant: count every feature in `sourceMissing` (replace the listed filter with all of `attributeProblems`, exact literal from the final code) must turn it red.
- [x] 3.4 Same file: an older-template Excel with one Peru row, Colombia selected; after deleting that row the source has no errors. **Fix tripwire** (red pre-change).
- [x] 3.5 Same file, `rereadSources`: delete the invalid row, read the Excel again for another country and back; the deleted row's error doesn't come back, and a remaining invalid row's error does. **Fix tripwire** (red pre-change).
- [x] 3.6 `useUploadSources.test.tsx`: drop an Excel with one invalid and one valid row through `addExcelFiles`, call `removeRow` on the invalid row, and assert `sourceErrors` is empty and `isUploadable` is true. **Fix tripwire** (red pre-change), the acceptance criterion of #171 at the hook level.

## 4. Existing tests and checks

Files: apps/web/src/utils/uploadSources.test.ts, apps/web/src/utils/geoFile.test.ts, apps/web/src/utils/geoFileJoin.test.ts, apps/web/src/utils/uploadExamples.test.ts, apps/web/src/utils/resultsExport.test.ts, apps/web/src/components/page/uploadData/useUploadSources.test.tsx

- [x] 4.1 Update only the existing assertions that the new shape or the message order (design decision 3) changes; never relax an assertion about which problems a file has. Record each one changed and why in the commit body.
- [x] 4.2 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint` and `pnpm test` pass.
