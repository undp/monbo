## Context

A farm's production date reaches the report as a string (`FarmData.productionDate: str`, `apps/api/app/models/farms.py:58`). The API never reads it: `validate_production_date` returns it unchanged (`apps/api/app/modules/farms/validations.py:130-136`). The browser formats it on the farm sheet through `shortFormatDateByLanguage` (`apps/web/src/utils/report/sections.tsx:384-385`), which does `format(new Date(date), …)` (`apps/web/src/utils/dates.ts:8-9`).

The string has one of three shapes, depending on how the farm was uploaded. Checked on 2026-11-25 with the repo's `xlsx` 0.20.3 and `date-fns` 4, varying only `TZ`:

| Input | String the farm gets | `America/Bogota` | `UTC` | `Asia/Tokyo` |
|---|---|---|---|---|
| Excel text cell, or geo file attribute | `2025-01-15` (F01 of `regression_farms.xlsx` is cell type `s`) | **14-01-2025** | 15-01-2025 | 15-01-2025 |
| Excel date cell | `toISOString()` of local midnight (`apps/web/src/utils/excel.ts:1019-1022`), e.g. `2025-01-15T05:00:00.000Z` in Bogotá | 15-01-2025 | 15-01-2025 | 15-01-2025 |
| Manual farm form | `new Date(year, month - 1, day).toISOString()` (`apps/web/src/components/page/uploadData/manualFarm/ManualFarmModalForm.ts:92-95`) | 15-01-2025 | 15-01-2025 | 15-01-2025 |

Only the date-only string is wrong: ECMAScript reads `YYYY-MM-DD` as UTC midnight, while a string with a time and an offset is an instant that `format` prints back in the zone that wrote it. The date-cell and manual paths are correct because the browser that writes the ISO string is the one that prints it.

A string that is not ISO behaves differently: `new Date("15/01/2025")` is an Invalid Date, and `format` throws `RangeError: Invalid time value`. The report download catches it and shows its error snackbar (`apps/web/src/hooks/useReportDownload.tsx:61-74`), so no PDF is produced for any farm.

## Goals / Non-Goals

**Goals:**

- The farm sheet prints the uploaded calendar day in every time zone, for the three inputs.
- A production date that cannot be read is printed as written, and the report is built.
- Tests that pin the time zone, so they fail on any machine if the bug comes back.

**Non-Goals:**

- Changing how the Excel loader, the manual form, the results export (`apps/web/src/utils/resultsExport.ts:61`) or the GeoJSON download (`apps/web/src/utils/download.ts:34`) store or write the date.
- Parsing non-ISO formats such as `15/01/2025`.
- Any API change.

## Decisions

### D1. Read a date-only string as a local calendar day, in `dates.ts`

Add to `apps/web/src/utils/dates.ts`:

```ts
// "2025-01-15" is a calendar day. `new Date` reads it as UTC midnight, which is
// still the day before west of UTC: read it as local midnight instead.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toCalendarDate = (date: string | Date): Date =>
  typeof date !== "string"
    ? date
    : DATE_ONLY.test(date)
      ? parseISO(date)
      : new Date(date);
```

`shortFormatDateByLanguage` and `longFormatDateByLanguage` both use it instead of `new Date(date)`. Strings with a time keep going through `new Date`, so the date-cell and manual paths, and the non-ISO strings V8 reads today (`01/15/2025`, `Jan 15 2025`), behave exactly as before. `longFormatDateByLanguage` only gets `new Date()` today (`sections.tsx:219`); it gets the same reading so the two functions can't disagree.

Alternatives rejected:

- **`parseISO` for every string.** It returns Invalid Date for the non-ISO strings `new Date` accepts today (`01/15/2025`, `2025/01/15`), so dates that print today would stop printing.
- **Store date-only strings at upload** (format the Excel `Date` and the manual input as `YYYY-MM-DD`). It fixes the display and also the exports east of UTC, but it touches `excel.ts` (shared with MB-4, #171), changes the exported files and the `frontend-unit-tests` scenario that expects an ISO string. It goes as a follow-up.
- **Format in UTC** (`formatInTimeZone(..., "UTC", ...)`). It breaks the other two inputs: the local midnight of Bogotá (`05:00Z`) still works, but the local midnight of Tokyo (`2025-01-14T15:00Z`) would print the 14th.

### D2. Print an unreadable date as written

`shortFormatDateByLanguage` returns its input when the parsed date is invalid (`isValid` from `date-fns`):

```ts
const dateObject = toCalendarDate(date);
if (!isValid(dateObject)) return date;
```

Its signature stays `(date: string, language: string): string`, so `sections.tsx` doesn't change. `longFormatDateByLanguage` keeps throwing on an invalid date: it only receives `new Date()`.

Rejected: printing `N/D` (`common:na`). It hides what the user wrote, and the date was not missing.

### D3. Pin the time zone in tests through a shared helper

New `apps/web/src/test/timeZone.ts`:

```ts
/** Runs the suite's tests in `zone`, and restores the machine's zone after each one. */
export const inTimeZone = (zone: string) => { beforeEach(...); afterEach(...); };
```

It sets `process.env.TZ` in `beforeEach` and restores the previous value (or deletes the variable) in `afterEach`. Node applies a new `TZ` at once (checked: `new Date("2025-01-15").getDate()` gives 14 after `process.env.TZ = "America/Bogota"` and 15 after `"Asia/Tokyo"` in the same process). Vitest's default pool is `forks` and `apps/web/vitest.config.mts` does not override it, so each test file has its own process and a zone cannot leak into another file. Tests use `describe.each(["America/Bogota", "UTC", "Asia/Tokyo"])`.

Any `Date` a test builds from local fields (`new Date(2025, 0, 15)`) has to be built **inside** the test, after the zone is set: a module-level constant is built in the machine's zone. `excelTemplates.test.ts` has one such constant, `PRODUCTION_DATE` (line 13), used by `FARM_ROW` (line 23); the new tests don't reuse it.

## Hazards

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/src/utils/dates.ts` | `new Date` on a date-only string shifts the day west of UTC: the bug this change fixes. Otherwise no history but the monorepo move. | Issue #51; `dates.ts:8`; `git log` shows only #54 |
| `apps/web/src/utils/dates.test.ts` | The current tests avoid the zone by using local `T12:00:00` strings (lines 4-5), so they pass on any machine and could never catch this bug. | `dates.test.ts:4-5` |
| `apps/web/src/test/timeZone.ts` (new) | A `TZ` not restored leaks into the rest of the file's tests. | Design D3 |
| `apps/web/src/utils/excelTemplates.test.ts` | `PRODUCTION_DATE` is built at import time in the machine's zone (line 13); a zone-pinned test that reuses it writes another instant. | `excelTemplates.test.ts:13,23` |
| `apps/web/src/utils/report.test.tsx` | The farm factory's date is a UTC instant, `2024-11-25T00:00:00.000Z` (`apps/web/src/test/factories.ts:21`), which prints the 24th west of UTC. No current test reads it; the new test sets its own date. | `factories.ts:21` |
| `apps/web/src/components/page/uploadData/manualFarm/ManualFarmModalForm.test.ts` (new) | No known hazard. The file under test was last changed in #97. | `git log` |

## API contract, data shape, cross-stack wiring

N/A: the change is inside the browser's formatting. `FarmData.productionDate` stays a string and no route changes.

## Signal tracing

N/A: the change introduces no marker, verdict or state read by another stage.

## Risks / Trade-offs

- [A date-only string with an invalid day, such as `2025-02-30`] → `parseISO` returns Invalid Date and D2 prints it as written. That's acceptable: it isn't a real day.
- [East of UTC, the exports still carry the previous day in their ISO string] → out of scope; proposed as a follow-up on the orchestration (#172).
- [Changing `process.env.TZ` in a test file] → restored in `afterEach`; isolated per file by the `forks` pool.

## Migration Plan

None. The change deploys with the web app and changes no stored data.
