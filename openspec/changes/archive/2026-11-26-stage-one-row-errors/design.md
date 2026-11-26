## Context

The stage 1 list builds its rows from `sources × sourceListedRows` (`apps/web/src/components/page/uploadData/FarmRowsTable.tsx:80-82`). Deleting a row adds its position to the source's `removedRows` (`withoutRow`, `apps/web/src/utils/uploadSources.ts:328-338`), and `sourceListedRows` filters those positions out (`uploadSources.ts:313-318`).

A source's problems, though, are flat lists computed for the whole file when it is read:

- **Excel (option 1).** `readExcelSource` stores `loadExcelFileFarmsData`'s `errorMessages` (`uploadSources.ts:92-117`). Those come from `validateData`, which walks the rows and pushes each row's messages into one list (`apps/web/src/utils/excel.ts:786-869`). When a row of an older template's country column names another country, the function returns that single message and skips the validation (`excel.ts:1057-1078`).
- **Geo file read from its attributes (option 2).** `withAttributeRows` stores `geoFeaturesToFarmRows`' `errorMessages` as `attributeErrors` and its `missing` as `attributeMissing` (`uploadSources.ts:153-171`). The messages are the API's per-feature issues (`featureIssues`, `apps/web/src/utils/geoFile.ts:108-116`) and one message per missing mandatory attribute of each feature (`geoFile.ts:234-248`). A feature declaring another country replaces them all with one message (`geoFile.ts:262-263`). `rows` is one row per feature, in feature order (`geoFile.ts:219`), including features with issues.
- **Geo file joined to an Excel (option 3).** `joinRowsWithGeoFeatures` returns no rows when there is any problem (`apps/web/src/utils/geoFileJoin.ts:147`).

`sourceErrors` returns those lists (`uploadSources.ts:356-365`), and everything else reads it: the notice (`FileNotice.tsx:39-40`), `isUploadable` (`uploadSources.ts:378-379`), the summary (`uploadSummary`, `uploadSources.ts:437-447`), `collectUpload` (`uploadSources.ts:485-494`) and the snackbar (`useUploadSources.ts:52-59`). `isMissingData` and the missing-data message read `attributeMissing` (`uploadSources.ts:394-398`, `411-419`).

## Goals / Non-Goals

**Goals:**

- Deleting a row drops the problems found in that row, for options 1 and 2.
- A file whose listed rows have no problem left stops being marked, everywhere `sourceErrors` is read.
- A geo file's missing data counts only its listed features.
- The deleted rows' problems stay dropped after the file is read again.

**Non-Goals:**

- Option 3: the join lists no row when anything fails, so there is nothing to delete.
- Whole-file problems: a geo file the API rejected (`uploadSources.ts:139-146`), an Excel without coordinates (`uploadSources.ts:112-114`), an Excel with coordinates attached to a geo file (`uploadSources.ts:196-217`).
- Marking the rows with problems in the table.
- Changing a message's text or adding i18n keys.

## Decisions

### 1. Problems are kept per row, parallel to the rows

A new module, `apps/web/src/utils/rowProblems.ts`, defines what is wrong with one row:

```ts
export interface RowProblems {
  /** The other-country message, when the row declares a country other than the
   * selected one */
  otherCountry: string | null;
  /** The rest of the row's problems, in the order they were found */
  errors: string[];
  /** The mandatory attributes a geo file's feature lacks; always empty for an
   * Excel row */
  missing: GeoAttributeKey[];
}

/** The rows' problems as one list of messages: each other-country message once,
 * first, then the rest in row order. */
export const problemMessages = (problems: RowProblems[]): string[] => [
  ...uniq(problems.flatMap(({ otherCountry }) => (otherCountry ? [otherCountry] : []))),
  ...problems.flatMap(({ errors }) => errors),
];
```

`GeoAttributeKey` is a type-only import from `@/utils/excel`, so the new module adds no runtime cycle.

The producers return one `RowProblems` per row, in the same order as their rows:

- `excel.ts`: a new exported `validateRows(params): string[][]` returns each row's messages, with `validateData` kept as `validateRows(params).flat()` so its callers and tests keep working. `loadExcelFileFarmsData` adds `rowProblems: RowProblems[]` to its result. Each row's `otherCountry` is the existing `common:parseFileError:otherCountry` message with that row's country alone. Every row is validated, also when some row names another country. Its `errorMessages` becomes `problemMessages(rowProblems)`.
- `geoFile.ts`: `geoFeaturesToFarmRows` adds `rowProblems: RowProblems[]`. Each feature's `errors` are its API issues and then its missing attributes; its `missing` the keys it lacks; its `otherCountry` is `otherCountryError([country], t, language, selectedCountry)` when it declares a country. `errorMessages` becomes `problemMessages(rowProblems)` and `missing` stays the aggregate it is today.

The sources keep them:

- `ExcelSource` gets `rowProblems: RowProblems[]`. `errorMessages` keeps only the whole-file problems: `[excelWithoutCoordinates]` or `[]`. With no coordinates, `rowProblems` holds no problems, since the whole-file message replaces them today.
- `GeoSource` gets `attributeProblems: RowProblems[]`, parallel to `attributeRows`. `attributeErrors` keeps only the API's rejection of the whole file. `attributeMissing` is removed: it is now derived.

`sourceErrors` becomes the whole-file problems plus the listed rows' problems:

```ts
/** The problems of the rows left in the list. */
const listedProblems = (removedRows: number[], problems: RowProblems[]) =>
  problems.filter((_, index) => !removedRows.includes(index));

// excel
[...source.errorMessages, ...problemMessages(listedProblems(source.removedRows, source.rowProblems))]
// geo without an Excel
[...source.attributeErrors, ...problemMessages(listedProblems(source.removedRows, source.attributeProblems))]
// geo with an Excel: source.excel.errorMessages, as today
```

A new `sourceMissing(source: GeoSource): MissingAttributes` derives what `attributeMissing` said from the listed features' `missing`: the keys in `DATA_KEYS` order (the order `geoFeaturesToFarmRows` reports them, `geoFile.ts:258-261`) and the number of listed features missing any. `isMissingData` and `sourceProblem` read it.

`removedRows` already survives a reread (`uploadSources.ts:271-287`), and the reread recomputes the problems for every row in the same order, so a deleted row's problems stay dropped with no extra code.

- **Alternative: store the problems inside each `FarmRow`.** `FarmRow` is the row the upload sends to `/farms/parse` (`apps/web/src/interfaces/FarmRow.ts:3-9`). A field there would be sent to the API or need stripping, and would mix UI state into the request.
- **Alternative: recompute the problems from the listed rows in `sourceErrors`.** It needs `t`, the language and the selected country in every caller of `sourceErrors`, and the geo file's API issues would have to be kept per feature anyway.
- **Alternative: filter the flat messages by their row number.** The messages are translated text: parsing "fila 5" back is brittle, and a geo feature's messages name its position and ID, not a row.

### 2. The other-country error is per row and per country

Today one message names every other country. A per-row message names its row's country, and `problemMessages` keeps each message once and first, so a file with farms in Peru only reads as today. A file with farms in Peru and Brazil now shows two messages, one per country, and deleting the Peru farms leaves only Brazil's.

Validating every row also when some row names another country means such a file now also lists its rows' other problems, after the country message. The country message stays the first one, the one the notice shows.

- **Alternative: keep the country check for the whole file.** Deleting the other country's farms would leave the file marked, which is this issue's bug again.
- **Alternative: one aggregated message rebuilt from the listed rows.** It needs `t` in `sourceErrors` (see decision 1).

### 3. Message order

`problemMessages` lists a file's problems by row. For an Excel the order is the same as today (`validateData` already walks rows). For a geo file it changes: today all API issues come first, then all missing attributes; now each feature's issues are followed by its missing attributes. The notice shows the first message, which can change for a geo file with both kinds of problems. No spec states this order.

## API contract, data shape, cross-stack wiring

N/A: the change lives in the web's upload state. No route, request, response or generated type changes, and nothing is persisted.

## Signal tracing

N/A: no new marker, label or verdict is emitted for another stage. The per-row problems are internal state read by the existing `sourceErrors` consumers.

## Hazards

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/src/utils/uploadSources.ts` | `removedRows` holds positions, not IDs: problems must be indexed by the same positions or deleting a row drops another row's problem. Option 3's `removedRows` index the joined Excel's rows, which never carry row problems. | `uploadSources.ts:32-35`, `50-53`; design of #147 (`openspec/changes/archive/2026-11-25-stage-one-unified-table/design.md:91-101`) |
| `apps/web/src/utils/uploadSources.ts` | `rereadSources` builds a new source and copies `removedRows` over: it must not keep stale problems. | `uploadSources.ts:271-287` |
| `apps/web/src/utils/excel.ts` | Row numbers in messages add 4 to the index (3 header rows); the per-row arrays must keep the index of `data`, not of the message. `loadExcelFileFarmsData` is also used by option 3 and by tests of the examples and the exports. | `excel.ts:795`; `apps/web/src/utils/uploadExamples.test.ts:268`, `apps/web/src/utils/resultsExport.test.ts:205`, `uploadSources.ts:186` |
| `apps/web/src/utils/excel.ts` | The country column is deleted from each row after the check (`delete row.country`): the per-row country must be read before that. | `excel.ts:1064` |
| `apps/web/src/utils/geoFile.ts` | A feature the API couldn't read still yields a row (`geometryType: null`): its issues must stay on that row. `geoFileJoin.ts` reuses `featureIssues` and `otherCountryError`, which keep their signatures. | `geoFile.ts:219-256`; `geoFileJoin.ts:70-78` |
| `apps/web/src/utils/rowProblems.ts` | New file, no history. | — |
| Tests (`uploadSources.test.ts`, `excel.test.ts`, `geoFile.test.ts`, `useUploadSources.test.tsx`) | Existing tests assert a geo file's first message and a single other-country message; the first can change with the order (decision 3). | `apps/web/src/utils/uploadSources.test.ts:160-162`; `apps/web/src/components/page/uploadData/useUploadSources.test.tsx:116-117` |

## Risks / Trade-offs

- **[A file with farms in two other countries shows two messages instead of one.]** → Each one names its country and says what to do; deleting one country's farms leaves the other's.
- **[An Excel from another country now also lists its rows' other problems.]** → The country message stays first, so the notice still says what matters first; the rest is under "Show errors".
- **[A geo file's first message can change.]** → It is still one of the file's real problems; no spec fixes the order.
