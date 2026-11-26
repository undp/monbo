## Why

The web keeps a hand-written copy of the API's built-in category id
(`DEFAULT_CATEGORY_ID = "deforestation"`, `apps/web/src/interfaces/AdminLayer.ts:31-32`),
which CLAUDE.md forbids ("Never write an API shape by hand"). Nothing imports it since #151, and
the contract never says, on the fields that carry a layer's category, that a layer without one
belongs to `deforestation`. Follow-up of #116 tracked in #168 (MB-8 of #172).

## What Changes

- The OpenAPI descriptions of `categoryId` (`BaseMapData`, `GET /maps`) and `category_id`
  (`AdminLayer`, `GET /admin/layers`) state that an index entry without a category belongs to the
  built-in `deforestation`, which every country has.
- `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` are regenerated (descriptions only;
  no shape changes).
- The unused web constant `DEFAULT_CATEGORY_ID` is removed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `layer-categories`: adds a requirement that the contract documents the default category on the
  fields that carry a layer's category.

## Impact

- API: `apps/api/app/models/maps.py`, `apps/api/app/modules/admin/models.py`,
  `apps/api/app/modules/maps/router.py` (docstring), `apps/api/openapi.json`.
- Web: `apps/web/src/api/schema.d.ts` (generated), `apps/web/src/interfaces/AdminLayer.ts`.
- No behaviour, shape or status-code change; no consumer outside this repo.

## Non-goals

- Exposing the id as a value (`GET /config` field or enum): no consumer reads it (decision of the
  user, 2026-11-26, option b of the planner's question).
- Changing how a missing `category_id` resolves (`store.py:102`).
