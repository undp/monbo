## Context

- Per-row problems: `RowProblems { otherCountry, errors, missing }`
  (`apps/web/src/utils/rowProblems.ts:3-15`); `problemMessages` lists the other-country message
  first, then the errors (`rowProblems.ts:23-30`). An Excel source keeps them in `rowProblems`,
  a geo file read from its attributes in `attributeProblems`, both by the position among the
  rows the source read (`utils/uploadSources.ts:48-52, 69-74`). A geo feature's `errors` are its
  geometry issues followed by one message per missing mandatory attribute
  (`utils/geoFile.ts:248-263`).
- The table builds its rows from `sourceListedRows`, which keeps each row's original `index`
  and drops the deleted ones (`uploadSources.ts:325-331`; `FarmRowsTable.tsx:79-81`). The ID
  cell is `FarmRowsTable.tsx:150-154`.
- The file notice already uses a warning icon (`WarningAmberRoundedIcon`, `FLOW_COLORS.warn`)
  for missing data and an error icon (`ErrorOutlineRoundedIcon`, `FLOW_COLORS.bad`) for the
  rest (`components/page/uploadData/FileNotice.tsx:42-73`; colours in
  `components/page/flow/flowStyles.ts:47-50`).
- `geoFeaturesToFarmRows` builds `missing` from `missingAttributes` and `featuresMissingData`
  (`geoFile.ts:224-225, 246-247, 273-276`); its only caller drops it (`uploadSources.ts:171`).
  `MissingAttributes` stays: `sourceMissing` returns it (`uploadSources.ts:373-381`).
- Percentage texts: `formatResultPercentage` writes "< X%" for an `ok` result and
  `formatFindingPercentage` the rest; the contract of each sign is in `utils/numbers.ts:186-246`.
- The documentation tests cap the Spanish visible text at 1,400 words with the details closed
  and require the same number of labelled details blocks in both languages
  (`utils/documentation.test.ts:133-143, 207-221`).

## Goals / Non-Goals

**Goals:** the user sees which rows to fix or delete; the dead counter is gone; the page
explains the signs. **Non-Goals:** see the proposal.

## Decisions

### D1. `rowMark` in `uploadSources.ts`

```ts
/** How the table marks a listed row: its problems and the notice's tone for them. */
export interface RowMark {
  messages: string[];
  tone: "warn" | "bad";
}

/** The mark of the source's row at `index` (its position among the rows the source
 * read); null when it has no problems of its own. A drawn farm and the rows of an Excel
 * joined to a geo file have none: the joined Excel's problems are the file's. */
export const rowMark = (source: UploadSource, index: number): RowMark | null => {
  const problems =
    source.kind === "excel"
      ? source.rowProblems[index]
      : source.kind === "geo" && !source.excel
        ? source.attributeProblems[index]
        : undefined;
  if (!problems) return null;
  const messages = problemMessages([problems]);
  if (messages.length === 0) return null;
  const missingOnly =
    !problems.otherCountry && problems.errors.length === problems.missing.length;
  return { messages, tone: missingOnly ? "warn" : "bad" };
};
```

*Rejected:* computing the mark inside the component: it would duplicate the source-kind switch
that `uploadSources.ts` owns, and couldn't be unit-tested without rendering.

### D2. The icon in the ID cell (approved: icon + tooltip + accessible label)

In `FarmRowsTable.tsx`, for each shown row, `const mark = rowMark(source, index);` and, before
the ID text inside the ID cell, when `mark` is not null:

- a `Tooltip` whose title is a list of `mark.messages`;
- wrapping a `Box component="span" role="img" tabIndex={0}` with
  `aria-label={t("common:farmsUpload:table:rowProblems", { name, problems: mark.messages.join(" "), interpolation: { escapeValue: false } })}`
  and colour `FLOW_COLORS.warn` or `FLOW_COLORS.bad`;
- holding `WarningAmberRoundedIcon` (tone `warn`) or `ErrorOutlineRoundedIcon` (tone `bad`),
  `fontSize="small"`, `aria-hidden`.

The ID cell lays the icon and the ID in one line (`display: inline-flex`, small gap). `name` is
the one the row's buttons already use (`FarmRowsTable.tsx:139`). New keys in
`locales/{es,en}/common.json` under `farmsUpload.table`:
- es `rowProblems`: "Problemas de {{name}}: {{problems}}"
- en `rowProblems`: "Problems in {{name}}: {{problems}}"

*Rejected (shown to the user):* a coloured row background, which needs a second cue for colour
blindness and fights the hover colour, and a "Problems" column, which takes width the table
doesn't have on a phone (`WIDE_ONLY` already hides two columns).

### D3. Drop `missing` from `geoFeaturesToFarmRows`

Remove `missing` from `FarmRowsResult`, the `missingAttributes` set, the `featuresMissingData`
counter and the `missing` object; the function returns
`{ rows, errorMessages: problemMessages(rowProblems), rowProblems }`. `MissingAttributes` stays
exported for `sourceMissing`.

### D4. The "More detail" block

In `content/documentation/{es,en}/calculation.md`, a new `:::details` block after "Más
detalle: el límite del método" / "More detail: the limit of the method":

- es label: "Más detalle: cómo se escriben los porcentajes"; en: "More detail: how the
  percentages are written".
- Content: one short paragraph saying that the report and the tables round each percentage and
  write a few cases with a sign, then one bullet per sign with what it means and whether the
  farm counts as having findings, as the `methodology-documentation` delta lists them. Use the
  page's terms: "observación" in Spanish (`content/documentation/es/categories.md:5-12`), and
  the matching term the English `categories.md` uses. Spanish uses the decimal comma
  ("< 0,1%", "> 99,9%"), English the point ("< 0.1%", "> 99.9%"). X is written as a letter, never
  a number.

Inside a details block it doesn't count towards the 1,400-word cap.

## API contract / data shape / cross-stack wiring

N/A: web-only; no API, contract or `DataContext` change.

## Signal tracing

N/A: no signal is introduced (the icon is UI for the user, read by no other code).

## Risks / Trade-offs

- [Long problem lists make the accessible name long] → a row rarely has more than two or three
  problems; the full text is what a screen reader user needs to decide.
- [Virtualized lists, from 100 rows] → the mark is computed per shown row, from data already in
  memory; no extra state.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/web/src/utils/uploadSources.ts` | Problems are by the original row position; using the table position shows a deleted row's problems on another | #179; `farm-upload` "Deleting a row drops its problems"; `uploadSources.ts:325-331` |
| `apps/web/src/utils/geoFile.ts` | `rowProblems[].missing` feeds `sourceMissing`; only the whole-file `missing` goes | `uploadSources.ts:373-381`; `geoFile.test.ts:239-242` |
| `apps/web/src/components/page/uploadData/FarmRowsTable.tsx` | Virtualization measures each row; a taller ID cell must not break it | `FarmRowsTable.tsx:55-95` |
| `apps/web/src/locales/{es,en}/common.json` | Keys in both locales | `src/locales/locales.test.ts` |
| `apps/web/src/content/documentation/{es,en}/calculation.md` | Word cap and details parity; no category threshold as a number | `utils/documentation.test.ts:133-143, 207-221`; `methodology-documentation` "The calculation section explains the percentage" |
| Test files | No known hazard | — |
