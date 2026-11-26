## Context

- `result-classification` keeps "The default rule until categories are wired"
  (`openspec/specs/result-classification/spec.md:46-57`), and "Each layer's rule comes from its
  category" ends with "The PDF report and the exports keep the default rule until they are moved
  to categories" (lines 96-103). The code already classifies both with the category's rule: the
  exports' columns call `categoryRule` and `classifyResult` (`apps/web/src/utils/layerCategories.ts:52-53`,
  used by `utils/resultsExport.ts:14` and `utils/geojson.ts:12`), the PDF's farm list through
  `farmCategoryResults` (`utils/farmCategoryResults.ts:44-52`); `category-report` requires it
  (`openspec/specs/category-report/spec.md:8`).
- `apps/api/README.md:252` says the frontend flags a farm above `DEFORESTATION_THRESHOLD_PERCENTAGE`
  "(labels, colours, exports, the report)" and that "the API doesn't use it itself". The API
  uses it as the threshold of a category without its own when it builds `GET /categories`
  (`apps/api/app/modules/maps/helpers.py:99`) and publishes it at `GET /config`
  (`apps/api/app/modules/config/router.py:22`).
- `apps/web/package.json:71` declares `"vitest": "^5.1.0"`; `apps/web/pnpm-lock.yaml` resolves
  `vitest@5.1.0` (line 3599).
- `utils/styling.ts:8-36` maps each class to `RESULT_COLORS` (`config/theme.ts:56-66`); the
  PDF (`utils/report/sections.tsx:136-139`), `ResultChip.tsx:16` and
  `SelectedPolygonsMap.tsx:171` paint with it. There is no `styling.test.ts`.

## Goals / Non-Goals

**Goals:** the spec and the README say what the code does; vitest is pinned; the class→colour
mapping has a test. **Non-Goals:** see the proposal (other dependencies, `docs/`, code).

## Decisions

- **D1. Spec:** REMOVE the default rule and MODIFY "Each layer's rule comes from its category"
  to name the PDF and the exports (delta in `specs/result-classification/spec.md`). The archive
  applies it to `openspec/specs/`; nobody edits the main spec by hand.
- **D2. README line 252**, replaced by:
  "`DEFORESTATION_THRESHOLD_PERCENTAGE`: the threshold, in percent, of a layer category that has
  no `threshold_percentage` of its own: the API uses it as that category's `thresholdPercentage`
  in `GET /categories`, and the frontend classifies the results of its layers with it (labels,
  colours, exports, the report). Type: Float. Range: 0-100. Default: 0. It is also published at
  `GET /config`; both thresholds are set only here, not in the frontend's environment."
  The overlap threshold line stays as it is.
- **D3. vitest:** `"vitest": "5.1.0"` in `package.json`, then `pnpm install` in `apps/web`; the
  lockfile's importer specifier changes from `^5.1.0` to `5.1.0` and nothing else resolves
  differently. *Rejected (the user's choice):* pinning all 48 web dependencies now.
- **D4. `styling.test.ts`:** assert each class against the `RESULT_COLORS` entry of the same
  name (colour and background), `getResultChipColor` / `getResultChipBackgroundColor` with an
  `avoid` rule of threshold 2 for `0.01` (ok) and `0.05` (flagged), and with a `null` rule and a
  `null` value (unknown). Compare with `RESULT_COLORS`'s fields, not hex literals: the test pins
  the mapping, which is what could swap the PDF's colours, not the palette, which the design
  owns.

## API contract / data shape / cross-stack wiring

N/A: no code path changes; the README and the spec only describe existing behaviour.

## Signal tracing

N/A: no signal is introduced.

## Risks / Trade-offs

- [The lockfile changes more than one line] → the coder checks the diff of `pnpm-lock.yaml`
  is only the specifier; if `pnpm install` re-resolves anything else, it stops and reports it.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `openspec/specs/result-classification/spec.md` (via delta) | A MODIFIED block whose header differs from the main spec fails the archive | `CLAUDE.md` Workflow; header copied verbatim from line 96 |
| `apps/api/README.md` | Contradicting `CLAUDE.md`'s "Product settings owned by the API" | `CLAUDE.md` Web conventions |
| `apps/web/package.json`, `apps/web/pnpm-lock.yaml` | CI installs with `--frozen-lockfile`; a stale lockfile fails both web jobs | `CLAUDE.md` Commands; `frontend-dependency-toolchain` "pnpm-managed frontend with pinned toolchain" |
| `apps/web/src/utils/styling.test.ts` | No known hazard (new file) | — |
