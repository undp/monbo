## Context

- `getRowCommonDataAsObject` (`apps/web/src/utils/download.ts:24-45`) builds the properties of
  every GeoJSON feature (`utils/geojson.ts:38-46`): `Area: "0"` at line 32 and
  `productionDate: farm.productionDate || ""` at line 34. Its return type is
  `Record<string, string>`; the feature type takes `Record<string, unknown>`
  (`hooks/useGeoJsonDownload.tsx:7-14`), and the image endpoint takes the feature as a plain
  `dict` (`apps/api/app/modules/layer_analysis/router.py:140-141`).
- `farmToTemplateRow` (`utils/resultsExport.ts:56-80`) writes the Excel row: `productionDate`
  raw at line 61, and the area as `farm.polygon.area / 10000` when it is above 0, else `""`
  (lines 68-74).
- `farm.polygon.area` is in m²; `null` or `-1` means the API could not compute it
  (`CLAUDE.md` invariants).
- Stored production dates: the Excel loader stores `Date.toISOString()` of the cell
  (`utils/excel.ts:1024-1028`), the manual form the ISO string of local midnight
  (`components/page/uploadData/manualFarm/ManualFarmModalForm.ts:90-95`), and geo files the
  attribute as written. The report shows them through `toCalendarDate`, which reads a
  `yyyy-MM-dd` string as a local day and anything else with `new Date` (`utils/dates.ts:6-11`),
  and `shortFormatDateByLanguage` writes the text it can't read as it was
  (`utils/dates.ts:13-21`).
- Re-import: `geoFeaturesToFarmRows` reads `Area` 0 or `"0"` as missing
  (`utils/geoFile.ts:236-238`). The round-trip test asserts it
  (`utils/geoFile.test.ts:61-92`, `area: null`).

## Goals / Non-Goals

**Goals:** the EUDR system reads the right area for every exported point; both exports write
the day the report shows. **Non-Goals:** see the proposal.

## Decisions

### D1. `Area` in hectares, points and polygons, omitted when unknown (approved)

In `download.ts`, exported for reuse:

```ts
/** The farm's area in hectares, not rounded; null when the API couldn't compute it. */
export const areaHectares = (farm: FarmData): number | null =>
  farm.polygon.area && farm.polygon.area > 0 ? farm.polygon.area / 10000 : null;
```

and in `getRowCommonDataAsObject` (return type `Record<string, string | number>`):

```ts
const area = areaHectares(farm);
...
    ProducerCountry: farm.country || "",
    ...(area !== null ? { Area: area } : {}),
```

`farmToTemplateRow` uses `area: areaHectares(farm) ?? ""`, the same values it writes today.

*Alternatives the user saw:* `Area` only on points (the EUDR description defines it for points;
its own examples also put it on polygons, and Monbo's re-import and API ignore it for polygons),
or never writing it (the EUDR system would assume 4 ha for every point). The user chose points
and polygons.

### D2. `calendarDay` in `dates.ts`

```ts
/** A date as the day the app shows for it (yyyy-MM-dd); a date it can't read, as written. */
export const calendarDay = (date: string): string => {
  const dateObject = toCalendarDate(date);
  return isValid(dateObject) ? format(dateObject, "yyyy-MM-dd") : date;
};
```

Both exports write `productionDate: farm.productionDate ? calendarDay(farm.productionDate) : ""`.
It is the same day `shortFormatDateByLanguage` shows, so the export, the report and the stage
tables agree (#51, #175).

*Rejected:* slicing the first 10 characters of the ISO string: for a date stored as local
midnight west of UTC that is right, but east of UTC (`2025-01-14T15:00:00.000Z` for 15 January
in Tokyo) it gives the day before.

### D3. Re-import keeps reading `"0"` as missing

`geoFile.ts:236-238` stays; only its comment changes to say that exports made before this change
wrote `"Area": "0"`. A new export uploaded again now brings its area in hectares, which the API
uses for points (`apps/api/app/utils/farms.py:210`) and ignores for polygons (computed,
`farms.py:221-229`).

## API contract / data shape / cross-stack wiring

N/A: the change is in the web's export files; the image endpoint takes the feature as a plain
`dict`, so a numeric `Area` is accepted.

## Signal tracing

N/A: no signal is introduced.

## Risks / Trade-offs

- [A tool that read Monbo's `Area` as a string now gets a number] → the EUDR format requires a
  number; Monbo's own re-import reads both.
- [Re-uploading an export now brings a point's area instead of the default] → that is the
  farm's real area, which the Excel export already round-trips
  (`results-export` "Excel exports can be uploaded again").
- [Existing tests build dates at UTC midnight] → those fixtures must be built from local fields,
  or the expected day depends on the machine's zone (`src/test/timeZone.ts`).

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/src/utils/download.ts` | The EUDR reads a string `Area` as 0; the property names are the EUDR's | EUDR GeoJSON description (proposal); `download.ts:19-23` |
| `apps/web/src/utils/dates.ts` | Dates shift a day west of UTC when read as UTC | #51, #175 (fix-production-date-timezone); `dates.ts:3-11` |
| `apps/web/src/utils/resultsExport.ts` | The export must upload again with the same farms | `results-export` "Excel exports can be uploaded again"; `resultsExport.test.ts:277-293` |
| `apps/web/src/utils/geoFile.ts` | Old exports carry `"Area": "0"` | `geoFile.ts:236-238`; `geoFile.test.ts:61-92` |
| Test files | Date tests depend on the zone unless pinned | `src/test/timeZone.ts` (`inTimeZone`, `TIME_ZONES`) |
