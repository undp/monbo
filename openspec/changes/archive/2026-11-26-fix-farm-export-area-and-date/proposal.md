## Why

Monbo's GeoJSON download writes `"Area": "0"` for every farm
(`apps/web/src/utils/download.ts:32`, with a TODO). The EUDR Information System reads `Area` as
the hectares of a `Point`, optional (4 ha when omitted), and only as a number: per its GeoJSON
file description, `"Area": "3"` is read as an area of 0. Today every point Monbo exports is read
by the EUDR system as 0 ha. The same function writes `productionDate` as stored, which for a
date from an Excel cell or the manual form is a UTC instant (`2025-02-14T03:00:00.000Z`) rather
than the day (`2025-02-14`); the Excel export repeats it (`apps/web/src/utils/resultsExport.ts:61`).
Both come from issue #185 (MB-10); the Excel date was found while planning.

Sources for the EUDR format (consulted 2026-11-26):
- https://eudr.webcloud.ec.europa.eu/tracesnt/help/eudr-documentation/operator/geojson-description.html
- https://nli.gov.cz/wp-content/uploads/EUDR-EUDR-GEOJSON-FILE-DESCRIPTION-1.5_.pdf

## What Changes

- The GeoJSON export writes `Area` as a number, the farm's area in hectares, not rounded, for
  points and polygons, when the API computed it (`area > 0`); it leaves `Area` out when the area
  is `null` or `-1`. This is what the Excel export already writes in its area column
  (`resultsExport.ts:68-74`).
- The GeoJSON and Excel exports write `productionDate` as the calendar day (`yyyy-MM-dd`) the
  rest of the app shows for it; a date the app can't read is written as it was typed.
- Uploading a GeoJSON exported before this change keeps working: `"Area": "0"` still reads as
  a missing area (`apps/web/src/utils/geoFile.ts:236-238`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `results-export`: the GeoJSON export follows the EUDR `Area` rule, and both exports write the
  production date as a day.

## Non-goals

- Changing how the API reads an uploaded area (points use it, polygons compute their own,
  `apps/api/app/utils/farms.py:210, 221-229`).
- Changing Monbo's own default point area (1 ha) or the EUDR one (4 ha).
- Other EUDR properties (`ProducerName`, `ProducerCountry`) or the custom ones.
- How dates are stored in the flow (`DataContext`): only the exports change.

## Impact

`apps/web/src/utils/download.ts`, `utils/dates.ts`, `utils/resultsExport.ts`, `utils/geoFile.ts`
(a comment) and their tests. No API, contract or locale change.
