Order: third change of the batch (issue #185, stage 1 and methodology). Groups 1, 2 and 3 are
disjoint. Mutants run with `node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file <file> --find <find> --replace <replace> --test <test>`
on the post-change tree, against the code prescribed in `design.md`. Each **fix tripwire** is
seen red on the pre-change tree first.

## 1. Row problems in the upload list

Files: apps/web/src/utils/uploadSources.ts, apps/web/src/utils/geoFile.ts, apps/web/src/components/page/uploadData/FarmRowsTable.tsx, apps/web/src/locales/es/common.json, apps/web/src/locales/en/common.json

- [x] 1.1 Add `RowMark` and `rowMark` to `uploadSources.ts` as in design D1.
- [x] 1.2 Mark the ID cell in `FarmRowsTable.tsx` with `const mark = rowMark(source, index);`
  and the icon, tooltip and accessible name of D2; add `farmsUpload.table.rowProblems` to both
  locales.
- [x] 1.3 Drop `missing` from `geoFeaturesToFarmRows` (D3); the return line reads
  `return { rows, errorMessages: problemMessages(rowProblems), rowProblems };`.

## 2. Methodology

Files: apps/web/src/content/documentation/es/calculation.md, apps/web/src/content/documentation/en/calculation.md

- [x] 2.1 Add the "More detail" block of D4 in both languages, with the signs written in bold
  (`**< X%**`, `**> X%**`, `**< 0,1%**` / `**< 0.1%**`, `**> 99,9%**` / `**> 99.9%**`, `**0%**`).

## 3. Tests

Files: apps/web/src/utils/uploadSources.test.ts, apps/web/src/utils/geoFile.test.ts, apps/web/src/components/page/uploadData/FarmRowsTable.test.tsx, apps/web/src/utils/documentation.test.ts

- [x] 3.1 `uploadSources.test.ts`, new `describe("rowMark")`:
  - **Fix tripwire:** an Excel row with an other-country message and an error gives both
    messages, the other-country one first, with tone `bad`; a geo file without Excel gives its
    feature's problems; a feature that only lacks the producer name has tone `warn`; a geo file
    with a joined Excel, a manual source and a row without problems give `null`. Red pre-change
    (no `rowMark`). Mutant for the tone: `--file apps/web/src/utils/uploadSources.ts --find "tone: missingOnly ? \"warn\" : \"bad\"" --replace "tone: \"bad\""`;
    mutant for the joined Excel: `--file apps/web/src/utils/uploadSources.ts --find ": source.kind === \"geo\" && !source.excel" --replace ": source.kind === \"geo\""`.
- [x] 3.2 `FarmRowsTable.test.tsx` (new; render with `I18nextProvider` and `createTestI18n("es")`
  as `FarmsUploadStep.test.tsx` does):
  - **Fix tripwire:** an Excel source of 3 rows whose `rowProblems[1]` has an error and whose
    `removedRows` is `[0]`: the row of `F02` has an element with role `img` whose accessible
    name contains "F02" and the error; the row of `F03` has none; focusing the icon shows the
    error in a tooltip. Mutant (problems by table position instead of the row's own):
    `--file apps/web/src/components/page/uploadData/FarmRowsTable.tsx --find "rowMark(source, index)" --replace "rowMark(source, position)"`.
  - **Regression guard:** a manual source shows no icon. Mutant:
    `--file apps/web/src/utils/uploadSources.ts --find "if (!problems) return null;" --replace "if (!problems) return { messages: [\"x\"], tone: \"bad\" };"`.
- [x] 3.3 `geoFile.test.ts`:
  - **Fix tripwire:** the result of `geoFeaturesToFarmRows` has exactly the keys `rows`,
    `errorMessages` and `rowProblems`. Mutant: `--file apps/web/src/utils/geoFile.ts --find "return { rows, errorMessages: problemMessages(rowProblems), rowProblems };" --replace "return { rows, errorMessages: problemMessages(rowProblems), rowProblems, missing: {} };"`.
  - The existing `rowProblems[].missing` assertions (lines 239-242) stay green (regression guard
    for `sourceMissing`'s input).
- [x] 3.4 `documentation.test.ts`:
  - **Fix tripwire:** the Spanish calculation section contains "< 0,1%", "> 99,9%", "< X%" and
    "> X%" inside a `details` block, and the English one "< 0.1%", "> 99.9%", "< X%" and
    "> X%". Mutant: `--file apps/web/src/content/documentation/es/calculation.md --find "**> 99,9%**" --replace "**99,9%**"`.
  - The existing word-cap and details-parity tests stay green.
- [x] 3.5 Run `pnpm exec vitest run src/utils src/components/page/uploadData src/locales`,
  `pnpm exec tsc --noEmit` and `pnpm run lint` in `apps/web`.
