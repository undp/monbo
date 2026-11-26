## Why

Three follow-ups of issue #185 (MB-2, MB-4):

- Since #179 each row of a file keeps its own problems, and deleting the row drops them, but the
  stage 1 table (`apps/web/src/components/page/uploadData/FarmRowsTable.tsx`) doesn't say which
  rows have them: the user reads the messages in the file's notice and hunts for the rows.
- `geoFeaturesToFarmRows` (`apps/web/src/utils/geoFile.ts:216-277`) still returns `missing`, a
  whole-file count of features missing data. Nothing reads it (its only caller keeps `rows`
  and `rowProblems`, `apps/web/src/utils/uploadSources.ts:171`; `sourceMissing` computes its
  own from the rows still listed, `uploadSources.ts:373-381`), and it doesn't leave out deleted
  rows.
- Since #174 the report and the tables write some percentages with a sign ("< 0,1%", "< X%",
  "> X%", "> 99,9%"), and the methodology page doesn't say what they mean.

## What Changes

- Each row of the stage 1 table that has problems shows an icon in its ID cell: the file
  notice's warning icon when the row only lacks mandatory data, its error icon otherwise. A
  tooltip lists the row's problems; the icon is focusable and its accessible name says the farm
  and its problems.
- `geoFeaturesToFarmRows` no longer returns `missing`.
- The calculation section of the methodology page gets a "More detail" block explaining the
  texts written with a sign, in Spanish and English.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `farm-upload`: the list marks the rows that have problems.
- `methodology-documentation`: the calculation section explains how percentages are written.

## Non-goals

- Marking rows of an Excel joined to a geo file: its problems belong to the whole file
  (`farm-upload` "Deleting a row drops its problems").
- Changing the file notices, the summary, or what blocks the upload.
- Changing how percentages are formatted (`apps/web/src/utils/numbers.ts`).

## Impact

`utils/geoFile.ts`, `utils/uploadSources.ts`, `components/page/uploadData/FarmRowsTable.tsx`,
`locales/{es,en}/common.json`, `content/documentation/{es,en}/calculation.md`, and their tests.
No API or contract change.
