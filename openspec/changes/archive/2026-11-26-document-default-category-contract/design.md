## Context

The API defines the built-in category id once, `DEFAULT_CATEGORY_ID = "deforestation"`
(`apps/api/app/modules/layers/categories.py:28`), and uses it to fill a missing `category_id`
(`apps/api/app/modules/layers/store.py:102`) and to reserve the id (`apps/api/app/modules/admin/categories.py:53`).
The web has a copy (`apps/web/src/interfaces/AdminLayer.ts:31-32`) with zero importers: the last
one was removed in `90242030` (#151). The contract mentions the built-in category only in route
descriptions (`apps/web/src/api/schema.d.ts:77` for `PUT /admin/categories/{id}`, `:268` for
`GET /categories`); the field descriptions say only "The id of the layer's category in its country
(see `GET /categories`)" (`apps/api/app/modules/maps/router.py:57-58`, rendered at
`schema.d.ts:595-596`), and `AdminLayer.category_id` has no description
(`apps/api/app/modules/admin/models.py:139`).

## Goals / Non-Goals

**Goals:** the contract says, where a client reads a layer's category, that no category means
`deforestation`; the web has no hand-written copy.

**Non-Goals:** a machine-readable value for the id (`GET /config`), any behaviour change.

## Decisions

1. **Description on the field, not only on the route.** `BaseMapData.categoryId` becomes
   `categoryId: str = Field(description=...)` (`apps/api/app/models/maps.py:31-33`, replacing the
   comment) and `AdminLayer.category_id` gets `Field(description=...)`. Both stay required (no
   default), so `tests/test_openapi.py::test_response_fields_are_all_required` is unaffected. The
   `GET /maps` docstring line (`router.py:57-58`) is updated to say the same, so the route and the
   field don't disagree.
   - Text (both fields): "The id of the layer's category in its country (see `GET /categories`).
     A layer whose index entry has no category belongs to the built-in "deforestation", which
     every country has." (double quotes, as the route descriptions at `schema.d.ts:77,268` write it)
   - Rejected: a `defaultCategoryId` in `GET /config` (option c) — a new field nobody reads.
     Rejected: deleting the constant only (option a) — leaves the contract silent on the fields.
2. **Delete the web constant** with its comment (`AdminLayer.ts:31-32`). `tsc --noEmit` proves no
   importer.
3. **Regenerate with `pnpm contracts`** (root), committing model, `openapi.json` and `schema.d.ts`
   together (CLAUDE.md, "Changing a contract").

API contract: N/A for shapes and status codes — descriptions only. Data shape: N/A — no new
field. Cross-stack wiring: the generated `schema.d.ts` is the only web artefact touched.

Signal tracing: N/A — the change introduces no signal.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/api/app/models/maps.py` | Adding a default to `categoryId` would make it optional in the OpenAPI and break the required-fields check | `json_schema_serialization_defaults_required` at `maps.py:12`; `tests/test_openapi.py:86` |
| `apps/api/app/modules/admin/models.py` | Same as above for `AdminLayer.category_id` | `models.py:137-139` |
| `apps/api/app/modules/maps/router.py` | Docstring is the route description in OpenAPI; a stale line contradicts the field | `router.py:57-58`, `schema.d.ts:595` |
| `apps/api/openapi.json`, `apps/web/src/api/schema.d.ts` | Stale generated files fail both CI jobs | CLAUDE.md "A contract change commits the model, openapi.json and schema.d.ts together"; `tests/test_openapi.py:46` |
| `apps/web/src/interfaces/AdminLayer.ts` | No known hazard (constant unused) | grep over `apps/web/src`, 2026-11-26 |

## Risks / Trade-offs

- [MB-7 (#180) also edits API models] → it touches `layer_analysis/models.py` only and doesn't
  regenerate `openapi.json`; whichever merges second regenerates.
