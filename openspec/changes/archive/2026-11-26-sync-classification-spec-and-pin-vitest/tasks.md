Order: fourth and last change of the batch (issue #186). Groups 1, 2 and 3 are disjoint.
Mutants run with `node "${INVENTURES_PIPELINE_HOME:-$HOME/.inventures-pipeline}/current/runtime/falsify.mjs" --file <file> --find <find> --replace <replace> --test <test>`.

Tasks 1.1 and 1.2 change only Markdown: their done-condition is read, not run. The batch has
runtime surface, so the rest of the plan has normal tests.

## 1. Spec and README

Files: openspec/changes/sync-classification-spec-and-pin-vitest/specs/result-classification/spec.md, apps/api/README.md

- [x] 1.1 The delta is written (this change). Done when `openspec validate
  sync-classification-spec-and-pin-vitest --strict` passes and, after the archive,
  `openspec/specs/result-classification/spec.md` has no "The default rule until categories are
  wired" and its "Each layer's rule comes from its category" names the PDF report and the
  exports.
- [x] 1.2 Replace `apps/api/README.md:252` with the text of design D2. Done when the line says
  the threshold applies to categories without their own and is used by `GET /categories`.

## 2. Pin vitest

Files: apps/web/package.json, apps/web/pnpm-lock.yaml

- [x] 2.1 Set `"vitest": "5.1.0"` and run `pnpm install` in `apps/web` (design D3). Done when
  `git diff apps/web/pnpm-lock.yaml` changes only vitest's specifier, and
  `pnpm install --frozen-lockfile` and `pnpm test` pass. Not testable by a unit test (it is
  the runner itself); the frozen install is the check, and CI repeats it.

## 3. Result colours test

Files: apps/web/src/utils/styling.test.ts

- [x] 3.1 Write `styling.test.ts` as in design D4.
  - **Regression guard** (green pre-change; the mapping is already right): mutants
    `--file apps/web/src/utils/styling.ts --find "ok: RESULT_COLORS.ok," --replace "ok: RESULT_COLORS.flagged,"`
    and `--file apps/web/src/utils/styling.ts --find "flagged: RESULT_COLORS.flaggedBackground," --replace "flagged: RESULT_COLORS.okBackground,"`
    each turn it red.
- [x] 3.2 Run `pnpm exec vitest run src/utils/styling.test.ts` and `pnpm exec tsc --noEmit` in
  `apps/web`.
