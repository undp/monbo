## Context

The analysis lives in `apps/api/app/modules/deforestation_analysis/`, mounted under `/deforestation_analysis` (`__init__.py`), with three routes in `router.py`: `POST /analize`, `POST /generate-image` and `GET /tiles/{country}/{map_id}/dynamic/{z}/{x}/{y}.png`. Its models (`models.py`) appear in `openapi.json` as `AnalizeBody`, `FarmDeforestation` and `MapData`. The web reaches them through `src/api/deforestationAnalysis.ts` and three URLs in `src/config/env.ts`, each overridable with a build-time `NEXT_PUBLIC_DEFORESTATION_ANALYSIS_*_URL` that no workflow, Dockerfile or Terraform file sets (checked 2026-11-16).

Other things that depend on the path:
- `UsageMiddleware` matches POST paths exactly (`app/modules/usage/tracking.py`, `TRACKED_ROUTES`) to record one `analysis` event per request;
- the regression pipeline (`tests/regression/pipeline.py`) runs in process for the pinned suite, and against deployed APIs through `tests.regression.parity`;
- many tests call the routes directly.

Web and API deploy from the same merge, in one `terraform apply` (`.github/workflows/deploy.yml`). Orchestration decision D11 named the new routes and D12 keeps the usage event names. On 2026-11-16 the product owner decided against keeping the old routes as aliases: usage tracking has not reached production, so losing the old route's events costs nothing.

## Goals / Non-Goals

**Goals:**
- One generic name for the analysis contract, spelled correctly, on both sides at once.
- No change to any number: the ratio, masking and images are untouched.

**Non-Goals:**
- Keeping the old routes as aliases (decision of 2026-11-16).
- Renaming web routes, components, hooks, i18n namespaces or the `deforestationAnalysis` page folder (GC-13).
- Renaming usage events, the `deforestation-analysis` module value, `DEFORESTATION_THRESHOLD_PERCENTAGE` or the satellite-limit variable (D12).
- Renaming the `deforestation-analysis` OpenSpec capability or the `DeforestationAnalysisMapResults` web alias. Both name the product concept and change with GC-6 and GC-13.
- Categories, polarity or thresholds (GC-1, GC-4).

## Decisions

### D1. Rename the prefix, no aliases

The module's `__init__.py` mounts the router at `/layer_analysis` with the tag "Layer Analysis Module". The handler `analize` becomes `analyze` on `POST /analyze`; `generate_image` and `serve_tile` keep their names. Nothing is served under `/deforestation_analysis` any more, and a request there gets FastAPI's 404.

*Alternative:* hidden aliases for one release (the first version of this proposal). Rejected by the product owner. Web and API ship together, the API has no known third-party clients, and the only data the aliases protected was usage events, which are not in production yet.

### D2. Rename the Python module to `layer_analysis`

`app/modules/deforestation_analysis/` → `app/modules/layer_analysis/` with `git mv`, and `tests/modules/deforestation_analysis/` → `tests/modules/layer_analysis/`. Every other module's package matches its prefix (`farms`, `polygons_validation`, `maps`, `usage`), and `CLAUDE.md` describes modules that way. `helpers.py` moves byte for byte, so `git` shows a rename and the numeric code has no diff. The export in `app/modules/__init__.py` becomes `layer_analysis_router`. The other open units (GC-1, GC-3) don't touch this package.

### D3. Schema names

| Old | New | Why |
|---|---|---|
| `AnalizeBody` | `AnalyzeBody` | spelling |
| `FarmDeforestation` | `FarmLayerResult` | a farm's value for one layer, any category |
| `MapData` | `LayerResults` | one layer's results; frees the name the web uses for a layer |

Fields keep their names, so the JSON is identical and the web code that reads it doesn't change. `GenerateImageBody` keeps its name. The handler rename changes its OpenAPI operation ID. The unused `DeforestationUnprocessedFarmData` stays as it is (not a contract schema; out of scope).

### D4. Usage tracking names the new route only

`TRACKED_ROUTES` maps `/layer_analysis/analyze` to `analysis` and drops `/deforestation_analysis/analize`. The event type, its fields and the dashboard don't change. Events recorded in `dev` before the deploy stay valid: an event has no path field.

### D5. Regression pipeline: new route, old route as a fallback for deployed APIs

`run_pipeline` posts to `/layer_analysis/analyze`. In process (`in_process=True`, the pinned regression suite), that is the only route. Against a deployed API (`in_process=False`, used by `tests.regression.parity`), a 404 there means the API predates this change, and the pipeline retries `/deforestation_analysis/analize`.

The fallback is needed because there are no aliases. The point of `parity` is to compare a release with the one before it, for example production before the train-1 release against `dev` after it. Without the fallback, the older API would answer 404 and the comparison would fail before comparing any number. A 404 on the new route can only mean the route is missing: unknown layers answer 400. The fallback is a few lines in the test tooling, not in the app, and its comment says it can go once production serves `/layer_analysis`. The pinned results (`tests/regression/`) and the numeric baseline are not regenerated.

### D6. Web client and URLs

- `src/api/deforestationAnalysis.ts` → `src/api/layerAnalysis.ts` with `git mv`.
- `analizeDeforestation` → `analyzeLayers` and `generatePolygonDeforestationImage` → `generateLayerImage`. `getMaps`, `MapLayerChangedError` and `ImageRequestError` keep their names.
- `env.ts` exports `LAYER_ANALYSIS_URL`, `LAYER_ANALYSIS_TILES_URL` and `LAYER_ANALYSIS_IMAGE_GENERATION_URL`, read from `NEXT_PUBLIC_LAYER_ANALYSIS_URL`, `_TILES_URL` and `_IMAGE_GENERATION_URL` with the usual `${NEXT_PUBLIC_API_URL}/layer_analysis/...` fallback.
- The old `NEXT_PUBLIC_DEFORESTATION_ANALYSIS_*_URL` names are not read any more, with no fallback. Nothing sets them, and a second name for a build-time override would only hide a stale config.
- `.env.template` lists the new names and drops `NEXT_PUBLIC_DEFORESTATION_ANALYSIS_PARSER_URL`, which no code reads. These overrides are build-time only, so `entrypoint.sh` and `infra/terraform/apps/web.tf` don't change (`CLAUDE.md`, "Web").
- `src/interfaces/DeforestationAnalysis.ts` keeps the name `DeforestationAnalysisMapResults`, now `= components["schemas"]["LayerResults"]`. Its comment drops the `MapData` name clash.

Tests mock `@/api/layerAnalysis`.

### D7. Documentation

- `CLAUDE.md`: the `analize` invariant goes away. The System map names the analysis route (`POST /layer_analysis/analyze`, `AnalyzeBody`) where it describes module 2.
- `docs/onboarding.md`: the "spelled `analize`" gotcha goes away. Route names, module path, client file and variable names are updated.
- `docs/architecture.md`, `docs/deforestation_calculation.md` and `apps/web/README.md`: route names, module path, client file and variable names.
- `CHANGELOG.md` `[Unreleased]` → `### Changed`: one entry for the routes (old ones removed), the schemas and the variables.

The OpenSpec delta specs change the route names inside the requirements; their behavior doesn't change.

## Risks / Trade-offs

- [A tab running the previous web bundle during or after the deploy calls the removed routes and gets 404 on analyze, tiles and images] → accepted by the product owner. The error shows the usual "could not analyze" message, and a reload fixes it. Deploys go to `dev` first, and production gets the change with a release.
- [An unknown third party calls `/deforestation_analysis/*`] → 404 after the release. The `CHANGELOG.md` entry names the new routes.
- [Someone sets `NEXT_PUBLIC_DEFORESTATION_ANALYSIS_*_URL` outside the repo] → it is silently ignored and the default URL is used, which is correct for every deployment we run. The CHANGELOG entry names the new variables.
- [GC-1 and GC-2 regenerate the same contract files] → on rebase, regenerate with `pnpm contracts`, never merge them by hand.
- [GC-6 and GC-7 import the old client] → this PR merges first (orchestration "Carril B"). They rebase onto `analyzeLayers` and `generateLayerImage`.

## Migration Plan

1. Merge to `dev`. The dev deploy serves only `/layer_analysis`. Check the full flow in `dev`, and that the usage dashboard counts the new analyses.
2. Release with train 1. In production, check the full flow and that `tests.regression.parity <prod-before> <dev>` passes through the fallback.
3. Once production serves `/layer_analysis`, the fallback in `tests/regression/pipeline.py` can go (follow-up).

Rollback: reverting the PR restores the old routes. Web and API roll back together, as they deploy today.

## Open Questions

(none: D11, D12 and the 2026-11-16 answers settle the names, the aliases and what stays)
