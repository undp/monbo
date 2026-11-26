## Why

In the stage 1 list, deleting the row that causes a file's error leaves the file marked with that error, and the step's button stays disabled. A file's errors are computed for the whole file when it is read (`sourceErrors` in `apps/web/src/utils/uploadSources.ts:356-365` returns `errorMessages` or `attributeErrors`), while deleting a row only adds its position to `removedRows` (`withoutRow`, `uploadSources.ts:328-338`). The only ways out today are removing the file or fixing it outside Monbo. The design of the unified list already recorded it as a follow-up (`openspec/changes/archive/2026-11-25-stage-one-unified-table/design.md:150`). Issue #171 (MB-4 of #172).

## What Changes

- The problems found in one row of a file are kept by row: an Excel row's validation errors (option 1), and a geo file feature's problems read from its attributes (option 2): the API's per-feature issues and the missing mandatory attributes.
- A row that declares a country other than the selected one carries the other-country error itself, one message per country, so deleting the farms of the other country clears it. Every row is now validated even when some row declares another country.
- A file's problems are its whole-file problems plus the problems of the rows still listed. Deleting the last row with a problem clears the file's notice, its "sources with problems" count and its "Show errors" list, and the file becomes uploadable.
- A geo file's missing data (the warning, "Attach Excel" and the missing-data message with its count) only counts the features still listed.
- A deleted row's problems stay dropped when the file is read again, for example after the country changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `farm-upload`: adds the requirement that deleting a row drops the problems found in that row.

## Impact

- Web only: `apps/web/src/utils/excel.ts`, `apps/web/src/utils/geoFile.ts`, `apps/web/src/utils/uploadSources.ts`, a new `apps/web/src/utils/rowProblems.ts`, and their tests.
- No API, contract, environment variable or i18n key changes: every message already exists.
- Non-goals:
  - A geo file joined to an Excel (option 3): the join rejects the whole Excel when any row or feature has a problem (`joinRowsWithGeoFeatures`, `apps/web/src/utils/geoFileJoin.ts:147`), so no row is listed and there is nothing to delete.
  - Whole-file problems: a geo file the API rejected, an Excel without coordinates, an Excel with coordinates attached to a geo file. They stay until the file is removed or fixed.
  - Marking in the table which rows have problems.
  - IDs repeated across sources, which `collectUpload` checks over the listed rows already (`uploadSources.ts:496-516`).
