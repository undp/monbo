## Why

The PDF report shows a farm's production date one day early in every time zone west of UTC, which covers every country Monbo supports today. `shortFormatDateByLanguage` builds the date with `new Date(date)` (`apps/web/src/utils/dates.ts:8`): JavaScript reads a date-only string such as `2025-01-15` as UTC midnight, and `date-fns` `format` prints it in the browser's zone, where it is still January 14. With `TZ=America/Bogota`, farm F01 of `apps/api/tests/regression/regression_farms.xlsx` (a text cell `2025-01-15`) prints `14-01-2025`. The report is audit evidence, so a wrong date that looks right is worse than an error (issue #51, unit MB-1 of #172).

## What Changes

- A production date written as a date-only ISO string (`YYYY-MM-DD`) is read as that calendar day in the browser's zone, not as a UTC instant. This covers text cells in the upload Excel and the attributes of geo files.
- Strings that carry a time (the ISO timestamps the Excel loader and the manual farm form write) keep being read as today, so the three ways a date arrives show the same day.
- A production date that cannot be read as a date is printed as written instead of making the PDF fail. Today `format` throws `RangeError: Invalid time value` and the whole download ends in the error snackbar.
- Tests pin the time zone (`America/Bogota`, `UTC`, `Asia/Tokyo`) and cover the three inputs: an Excel text cell, an Excel date cell and the manual farm form.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `category-report`: the farm sheet's production date is the calendar day the user uploaded, whatever the browser's time zone, and a date that cannot be read is shown as written.

## Impact

- Code: `apps/web/src/utils/dates.ts` only. Callers stay as they are: the farm sheet (`apps/web/src/utils/report/sections.tsx:385`) and the report date (`sections.tsx:219`).
- Tests: `apps/web/src/utils/dates.test.ts`, `apps/web/src/utils/excelTemplates.test.ts`, `apps/web/src/utils/report.test.tsx`, a new `apps/web/src/components/page/uploadData/manualFarm/ManualFarmModalForm.test.ts` and a new shared helper `apps/web/src/test/timeZone.ts`.
- No API, contract, dependency or environment change. `apps/web/src/utils/excel.ts` is not touched, so this unit does not conflict with MB-4 (#171).

## Non-goals

- Changing how dates are stored. The Excel loader (`excel.ts:1019-1022`) and the manual form (`ManualFarmModalForm.ts:92-95`) keep writing the ISO string of local midnight, and the results export (`resultsExport.ts:61`) and the GeoJSON download (`download.ts:34`) keep writing that string as is. East of UTC that string carries the previous day (`2025-01-14T15:00:00.000Z` in Tokyo); it is proposed as a follow-up.
- Guessing the format of non-ISO text such as `15/01/2025`. It is shown as written.
- The API: `validate_production_date` (`apps/api/app/modules/farms/validations.py:130-136`) passes the string through and stays that way.
