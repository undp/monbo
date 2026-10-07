## Context

- **The API side.** FastAPI builds an OpenAPI 3.1 document from the Pydantic models and `response_model`s. 11 of the 20 routes declare one; the rest serve HTML, PNG tiles, files, or the admin's job endpoints, which return `dict`s. With a flat layers root the document has 11 paths and 21 schemas. The admin router (5 more paths, 10 schemas) is only included when the admin is enabled (`create_app`).
- **The web side.** It has hand-written interfaces in `src/interfaces/` (`AdminLayer`, `DeforestationAnalysis`, `Farm`, `Map`, `Page`, `PolygonValidation`, `SelectionOption`), re-exported by `index.ts` and imported from 72 places, plus fetch helpers in `src/api/`.
- **Differences found:**
  - `FarmData.polygon` nullability: the model says nullable, but no response ever has `null` (the web is right);
  - `region`/`association` nullability (the API is right);
  - `PolygonSummary` and the polygon validation's inconsistencies (the web's unions are more precise);
  - ingestion jobs (only the web models them).

## Goals / Non-Goals

**Goals:**

- One source for request and response shapes: the Pydantic models, through the OpenAPI.
- Generated web types that are at least as precise as today's hand-written ones.
- CI fails when a model changes without the artifacts being regenerated.
- No change to the JSON the API returns.

**Non-Goals:**

- Generating a client (fetch functions). The `src/api/*` helpers stay and get typed with the generated types.
- Runtime validation in the web (zod and the like).
- Deriving the admin form's validation rules from the schema.
- Purely frontend types (`Page`, `SelectionOption`, form state).

## Decisions

### D1. Export the OpenAPI with the admin included, deterministically

`app/openapi.py` builds the app through `create_app(include_admin=True)`, which registers the admin router regardless of the environment. It writes `apps/api/openapi.json` with sorted keys, 2-space indent and a trailing newline, so the same models always produce the same bytes. The command is `uv run python -m app.openapi`; `--check` compares instead of writing and exits non-zero on a difference.

- **Why commit it:** contract changes become visible in pull request diffs, consumers (or the next tool) need no running API, and the web's generation doesn't need Python.

### D2. `openapi-typescript`, types only

`openapi-typescript` 7.13.0 (exact devDependency of `apps/web`) generates `src/api/schema.d.ts` from `../api/openapi.json`. The web uses `components["schemas"]["FarmData"]` and friends through the interface files:

```ts
// src/interfaces/Farm.ts
import type { components } from "@/api/schema";
export type FarmData = components["schemas"]["FarmData"];
```

`generate:api-types` runs it; `--check` mode (or regenerate plus `git diff --exit-code`) verifies it in CI.

- **Alternative: generate a client (orval, hey-api).** Rejected for now: it would replace the `src/api` layer, a much larger change than removing duplicated types.
- **Alternative: pydantic2ts.** Rejected: it skips the routes, and the OpenAPI is already the published contract.

### D3. Make the models precise before generating

A generated type is only as good as the model behind it.

- **`PolygonSummary`** becomes `Annotated[PointSummary | PolygonAreaSummary, Field(discriminator="type")]`:
  - `PointSummary`: `type: Literal["point"]`, `details: PointDetails`, `area: float`;
  - the polygon one: `type: Literal["polygon"]`, `details: PolygonDetails | None`, `area: float | None`.
  The serialized JSON is identical, which the regression suite checks.
- **`PolygonInconsistency`** becomes a union discriminated on `type`, one model per kind the helpers build: `overlap` (`OverlapData`), `invalid_geometry` (`InvalidGeometryInconsistencyData`) and `empty_polygon` (`data: None`). The web's hand-written union lacked `empty_polygon`.
- **Ingestion job:** an `IngestionJob` model (status, phase, progress, error, report, timestamps), mirroring what `refresh_job` returns today, plus `JobAccepted` (`{jobId}`) and `JobCancelled` (`{jobId, cancelled}`). They are wired in as `response_model`s on the three job routes. The admin tests check the shapes are unchanged.
- **`FarmData.polygon`** becomes required. Its `None` was only a placeholder while `parse_base_information` built the farm: every response has a polygon, or the request fails with a 400. The function now builds the summary first. `region` and `association` stay nullable, and the web is fixed (D5).
- **Defaulted response fields are required.** Pydantic leaves a field with a default out of `required`, so the generated type would mark it optional (`warnings?`), although every response includes it. Response models with defaults (`FarmData`, `BaseMapData`, `IngestionJob`, `JobIssue`, `StoredAttributes`) set `json_schema_serialization_defaults_required`. A test fails when any schema reachable from a response has an optional field.

### D4. CI freshness checks and detection

- **API job:** after the tests, `uv run python -m app.openapi --check`.
- **Frontend job:** after install, `pnpm run generate:api-types` and `git diff --exit-code src/api/schema.d.ts`.
- **Detection** gains `apps/api/openapi.json → api, web`, placed **before** the `apps/api/*` pattern, which would otherwise catch it first. A model change that regenerates `openapi.json` therefore also runs the frontend's type-check against the new contract.
- **The spec** also records the existing `apps/web/public/files/* → api, web` rule.

### D5. Migrate the interfaces, then fix what the compiler finds

1. Each hand-written API interface becomes an alias of the generated type. Names stay the same, so imports don't change.
2. `tsc --noEmit` then reports the places that assumed the hand-written shapes, for example a deforestation `value` that can be `null`, or a layer `alias` that can be `null`. Each one is fixed to match the API's real behaviour.
3. Purely frontend types stay hand-written.

## Risks / Trade-offs

- **[Risk] The model refactor changes the JSON.** → Mitigation:
  - the regression suite (`tests/regression`) compares full responses against `expected_results.json`;
  - the admin tests cover the job shapes;
  - `openapi.json`'s diff is reviewed.
- **[Risk] Generated names differ from the web's names** (e.g. `PolygonInconsistenciesResponse`). → Mitigation: the alias layer in `src/interfaces/` keeps the web's names.
- **[Risk] FastAPI produces different schemas for input and output** (`-Input`/`-Output` suffixes) for some models. → Mitigation: the export uses FastAPI's default separation, the aliases pick the right side, and it is documented.
- **[Trade-off] Two committed generated files.** They are worth it for diffs and offline generation; CI guarantees they're current.

## Migration Plan

1. API: models (D3), export (D1), committed `openapi.json`, tests.
2. Web: devDependency, generate, aliases, fixes (D5); tsc, lint, build.
3. CI and root script (D4); docs.
4. PR into `dev`. Merging deploys both apps with no change in behaviour.

**Rollback:** revert. Nothing runtime depends on the generated files beyond types.

## Open Questions

None.
