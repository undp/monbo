## Why

The web's request and response types are written by hand in `apps/web/src/interfaces/`: 7 files, 230 lines, imported from 72 places. They mirror the API's Pydantic models, and `admin/models.py` and `AdminLayer.ts` even say so in their headers. Nothing checks that they agree, and today they don't. Compared with the OpenAPI that FastAPI already produces:

- **`FarmData.polygon` is nullable in the API model,** but never `null` in a response: the web's type is the right one.
- **`region` and `association` are `string | null` in the API,** but `?: string` in the web's type.
- **The other way round, the web's `PolygonSummary` is more precise.** It is a discriminated union (`point` → `PointDetails`), while the Pydantic model is a flat `type` + `details`. The same holds for the polygon validation's inconsistencies (`type: str`), and the web's union misses the `empty_polygon` kind the API returns.
- **The ingestion job responses have no model in the API at all.** They are `dict`s, and only the web's `IngestionJob` and `RasterReport` describe them.

The technical review lists this as debt that grows with every module, and the `layer-administration` spec currently formalizes the manual mirroring. This is the second of two small changes. The first, `api-config-endpoint`, adds `GET /config`, which this one will type too.

## What Changes

- **The API's OpenAPI becomes a committed artifact:** `apps/api/openapi.json`.
  - It is exported deterministically by `uv run python -m app.openapi`, with the admin routes included, which are otherwise only registered when the admin is enabled.
  - Contract changes show up in pull request diffs.
- **The web's API types are generated from it** with `openapi-typescript` (types only, no runtime code, version pinned): `apps/web/src/api/schema.d.ts`, via `pnpm generate:api-types`.
- **The hand-written interfaces become aliases** of the generated types, so the 72 imports don't change. Their files keep only what is purely frontend (form state, UI-only types).
- **The Pydantic models are made as precise as the web needs:**
  - `PolygonSummary` becomes a discriminated union on `type`;
  - so does `PolygonInconsistency` (`overlap`, `invalid_geometry`, `empty_polygon`);
  - the ingestion job and the upload/cancel responses get models and `response_model`s.
  The JSON returned is unchanged, which the regression suite checks.
- **Places that didn't handle the API's real shapes are fixed:** for example, a `null` deforestation value, layer alias, or association.
- **Response fields the API always sends are required** in the contract, including the ones with defaults; `FarmData.polygon` becomes required.
- **CI checks that the contracts are fresh:**
  - the API job fails if `openapi.json` is stale;
  - the frontend job fails if `schema.d.ts` is stale.

  Change detection runs both jobs when `apps/api/openapi.json` changes.
- **A root `pnpm contracts`** runs both steps (export, then generate).

## Capabilities

### New Capabilities

- `api-contracts`:
  - the API's OpenAPI, including the admin, is the single source of request and response shapes;
  - it is committed and kept current;
  - the web's API types are generated from it and checked in CI;
  - no hand-written duplicates.

### Modified Capabilities

- `continuous-integration`: change detection also runs both jobs for `apps/api/openapi.json`. It also records the existing rule for `apps/web/public/files/`, added during #54's review but never written into the spec.
- `layer-administration`: the requirement for contracts mirrored by hand between the API and the frontend becomes contracts generated from the API.

## Impact

- **API:**
  - `app/openapi.py` (export) and `create_app(include_admin=...)`;
  - models: `PolygonSummary` and `PolygonInconsistency` unions, ingestion job, upload and cancel responses;
  - the committed `apps/api/openapi.json`;
  - tests.
- **Web:**
  - `openapi-typescript` as an exact devDependency;
  - `src/api/schema.d.ts` (generated, committed);
  - `src/interfaces/*` become aliases;
  - fixes where the real shapes weren't handled;
  - a `generate:api-types` script.
- **Root and CI:**
  - a `contracts` script in the root `package.json`;
  - `.github/workflows/ci.yml`: freshness steps, and a detection rule for `openapi.json`.
- **Docs and agent skills:**
  - the API and web READMEs ("changing a contract");
  - `docs/architecture.md`;
  - the PR skills (contracts are no longer mirrored by hand);
  - `CHANGELOG.md`.
- **Behaviour:** none. The responses are byte-for-byte the same JSON.
