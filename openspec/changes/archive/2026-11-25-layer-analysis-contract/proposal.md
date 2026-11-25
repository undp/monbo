## Why

Monbo is moving from a deforestation-only analysis to one that crosses farms with layers grouped in per-country categories (Deforestación, Áreas protegidas, Frontera agrícola; orchestration undp/monbo#116, decision D11). The analysis contract is still named after deforestation: `POST /deforestation_analysis/analize`, `AnalizeBody`, `FarmDeforestation` and a result schema called `MapData`, which also clashes with the web's own `MapData` (a layer). The endpoint name carries a misspelling that `CLAUDE.md` has to warn about. Renaming the contract now, before the category units (GC-6, GC-7) build on the web client, makes the rename one small change instead of a conflict in every later PR (sub-issue undp/monbo#128).

## What Changes

- **BREAKING:** the analysis routes move to the prefix `/layer_analysis`: `POST /layer_analysis/analyze`, `POST /layer_analysis/generate-image` and `GET /layer_analysis/tiles/{country}/{map_id}/dynamic/{z}/{x}/{y}.png`. Same handlers, same bodies, same responses. The old `/deforestation_analysis/*` routes are removed, with no alias: the web and the API ship together, and the product owner accepted that a client of the old routes stops working (decision of 2026-11-16).
- **BREAKING (contract):** schemas renamed `AnalizeBody` → `AnalyzeBody`, `FarmDeforestation` → `FarmLayerResult`, `MapData` → `LayerResults`. Field names don't change (`country`, `maps`, `farms`, `farmId`, `value`, `mapId`, `version`, `farmResults`), so the JSON bodies are identical.
- The Python module `app/modules/deforestation_analysis/` becomes `app/modules/layer_analysis/`, matching its prefix like every other module. The math in `helpers.py` moves unchanged.
- Usage tracking records the `analysis` event for `POST /layer_analysis/analyze` only. Usage tracking has not reached production, so no production history is split. Event names and the `deforestation-analysis` module value don't change (D12).
- The regression pipeline calls the new route. Against a deployed API that answers 404 there, it falls back to the old route, so `tests.regression.parity` can compare this release with the one before it.
- Web: `src/api/deforestationAnalysis.ts` becomes `src/api/layerAnalysis.ts` (`analyzeLayers`, `generateLayerImage`). The endpoint URLs become `LAYER_ANALYSIS_URL`, `LAYER_ANALYSIS_TILES_URL` and `LAYER_ANALYSIS_IMAGE_GENERATION_URL`, overridable with build-time `NEXT_PUBLIC_LAYER_ANALYSIS_*_URL`; the old variable names are no longer read. The interface aliases in `src/interfaces/` point to the renamed schemas and keep their names.
- `CLAUDE.md` drops the "`analize` is the contract spelling" invariant and names the new route. `docs/`, the web README, `.env.template` and `CHANGELOG.md` are updated.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deforestation-analysis`: the ratio is served by `POST /layer_analysis/analyze`.
- `usage-tracking`: the usage headers and the `analysis` event name the new route.
- `layer-storage`: tile and analysis routes named with the new prefix.
- `report-generation`: report images come from `POST /layer_analysis/generate-image`.
- `farm-geometry`: the round-trip requirement names the new routes.
- `agent-guidance`: `CLAUDE.md` names the analysis route instead of the `analize` spelling.

## Impact

- **API:** `app/modules/layer_analysis/` (renamed from `deforestation_analysis/`), `app/modules/__init__.py`, `app/main.py`, `app/modules/usage/tracking.py`, a docstring in `app/utils/image_generation/RasterDatasetCache.py`. Tests under `tests/modules/deforestation_analysis/` move to `tests/modules/layer_analysis/`. The tests that call the routes (`admin`, `layers`, `usage`), `tests/regression/`, and the imports in `tests/numeric_baseline/_common.py` and `tests/utils/test_loss_drawing.py` follow.
- **Clients:** any caller of `/deforestation_analysis/*` gets 404 after the deploy. That includes a browser tab still running the previous web bundle until it reloads.
- **Contract:** `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` regenerated together.
- **Web:** `src/api/layerAnalysis.ts`, `src/config/env.ts`, `src/interfaces/DeforestationAnalysis.ts`, and the files that import the client (upload page, map overlay, `DataContext`, `ReportContext`, report hook, `deforestationImages.ts` and their tests). Component, hook, page and i18n names stay as they are (GC-13).
- **Config:** `NEXT_PUBLIC_DEFORESTATION_ANALYSIS_*_URL` become `NEXT_PUBLIC_LAYER_ANALYSIS_*_URL`. They are build-time overrides that no workflow, Dockerfile or Terraform file sets, so `entrypoint.sh` and `infra/` don't change.
- **Numbers:** none. `tests/test_numeric_baseline.py` and the regression suite must stay green without regenerating.
- **Docs:** `CLAUDE.md`, `docs/onboarding.md`, `docs/architecture.md`, `docs/deforestation_calculation.md`, `apps/web/README.md`, `CHANGELOG.md`.
