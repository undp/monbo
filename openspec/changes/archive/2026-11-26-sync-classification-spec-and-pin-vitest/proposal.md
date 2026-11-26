## Why

Follow-ups of issue #186 (MB-7, MB-8), none of which changes the app's behaviour:

- `openspec/specs/result-classification/spec.md:46-57` still requires the PDF and the exports
  to classify with polarity `avoid` and the global threshold "until categories are wired", and
  its "Each layer's rule comes from its category" (lines 96-120) says they keep that rule. They
  already use each layer's category: the exports through `layerResultColumns`
  (`apps/web/src/utils/layerCategories.ts:52-53`), the PDF through `farmCategoryResults`
  (`apps/web/src/utils/farmCategoryResults.ts:44-52`), as `category-report` requires
  (`openspec/specs/category-report/spec.md:8`).
- `apps/api/README.md:252` describes `DEFORESTATION_THRESHOLD_PERCENTAGE` as the threshold of
  everything and says the API doesn't use it. It is the fallback for a category without its own
  threshold, which the API resolves in `GET /categories`
  (`apps/api/app/modules/maps/helpers.py:99`).
- `vitest` is `^5.1.0` in `apps/web/package.json:71`; `CLAUDE.md` asks for exact versions.
- No test pins the PDF's colours per class (`apps/web/src/utils/styling.ts`). #183 left it out;
  the user chose to add it now.

## What Changes

- Remove the requirement "The default rule until categories are wired" and state in "Each
  layer's rule comes from its category" that the PDF and the exports use the category's rule.
- Reword the README line.
- Pin `vitest` to `5.1.0`, the version the lockfile already resolves.
- Add `styling.test.ts`, pinning colour and background per class and a `null` rule read as no
  data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `result-classification`: remove the default rule; the category rule covers the PDF and exports.
- `frontend-unit-tests`: the test runner is pinned, and the result colours are covered.

## Non-goals

- Pinning the other 47 web dependencies declared with `^` (`apps/web/package.json:22-71`): the
  user chose to leave them for a separate issue.
- The sequence diagram of `docs/architecture.md` (`GET /countries` checking `has_raster`): the
  documenter stage writes `docs/` once over the closed batch; the pipeline's planner never plans
  tasks under `docs/`. The PR says so.
- Any change to the classification code or the colours.

## Impact

`openspec/specs/result-classification/spec.md` (through this change's delta),
`apps/api/README.md`, `apps/web/package.json`, `apps/web/pnpm-lock.yaml`,
`apps/web/src/utils/styling.test.ts` (new).
