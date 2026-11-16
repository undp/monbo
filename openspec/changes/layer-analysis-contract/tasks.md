## 1. API module and routes

- [x] 1.1 `git mv apps/api/app/modules/deforestation_analysis apps/api/app/modules/layer_analysis` and `git mv apps/api/tests/modules/deforestation_analysis apps/api/tests/modules/layer_analysis`; fix every import and `patch("app.modules.deforestation_analysis...")` target, including `tests/numeric_baseline/_common.py` and `tests/utils/test_loss_drawing.py` (design D2). `helpers.py` stays byte for byte
- [x] 1.2 Rename the models: `AnalizeBody` → `AnalyzeBody`, `FarmDeforestation` → `FarmLayerResult`, `MapData` → `LayerResults`, fields unchanged (design D3)
- [x] 1.3 In `router.py`, rename the handler `analize` → `analyze` on `POST /analyze`; keep `generate_image` and `serve_tile`; update the comment that names `/analize`
- [x] 1.4 In the module's `__init__.py`, mount the router at `/layer_analysis` with the tag "Layer Analysis Module"; nothing stays under `/deforestation_analysis` (design D1)
- [x] 1.5 Export `layer_analysis_router` from `app/modules/__init__.py` and include it in `app/main.py`
- [x] 1.6 Update the `/analize` mention in `app/utils/image_generation/RasterDatasetCache.py`

## 2. Usage tracking

- [x] 2.1 Map `/layer_analysis/analyze` to `analysis` in `TRACKED_ROUTES` and drop the old path (design D4)
- [x] 2.2 In `tests/modules/usage/test_server_events.py`, call the new route

## 3. API tests and regression

- [x] 3.1 Point the route calls in the tests to `/layer_analysis/...` (`tests/modules/layer_analysis/`, `admin/test_ingestion.py`, `admin/test_layers.py`, `layers/test_countries_layout.py`, `layers/test_store.py`) and rename `test_analize*` / `_analize` helpers to `analyze`
- [x] 3.2 Add a test that `POST /deforestation_analysis/analize`, `POST /deforestation_analysis/generate-image` and a `GET /deforestation_analysis/tiles/...` answer 404, and that the analize one records no usage event
- [x] 3.3 Add a test in `tests/test_openapi.py` that the document has the `/layer_analysis` paths and the `AnalyzeBody`, `LayerResults` and `FarmLayerResult` schemas, and none of the `/deforestation_analysis` paths or the old schema names
- [x] 3.4 `tests/regression/pipeline.py` posts to `/layer_analysis/analyze` and, only for a deployed API (`in_process=False`) that answers 404, retries `/deforestation_analysis/analize`, with a comment that it goes once production serves `/layer_analysis`; update the docstrings of `pipeline.py` and `parity.py` (design D5)
- [x] 3.5 Add a test of the fallback with a fake client: 404 on the new route → the old route is called; in process → no fallback. The pinned regression results and the numeric baseline are not regenerated

## 4. Contract

- [x] 4.1 Run `pnpm contracts` and commit `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` with the model change

## 5. Web

- [x] 5.1 In `src/config/env.ts`, replace the three `DEFORESTATION_ANALYSIS_*` exports with `LAYER_ANALYSIS_URL`, `LAYER_ANALYSIS_TILES_URL` and `LAYER_ANALYSIS_IMAGE_GENERATION_URL`, read from `NEXT_PUBLIC_LAYER_ANALYSIS_*_URL` with the `${NEXT_PUBLIC_API_URL}/layer_analysis/...` fallback, and no fallback to the old variable names (design D6)
- [x] 5.2 `git mv src/api/deforestationAnalysis.ts src/api/layerAnalysis.ts`; rename `analizeDeforestation` → `analyzeLayers` (body typed as `AnalyzeBody`) and `generatePolygonDeforestationImage` → `generateLayerImage`; keep `getMaps` and the error classes
- [x] 5.3 Point `DeforestationAnalysisMapResults` in `src/interfaces/DeforestationAnalysis.ts` to `LayerResults`, keeping its name, and update its comment
- [x] 5.4 Update every import and mock of `@/api/deforestationAnalysis` and the two renamed functions (upload page, `DeforestationMapOverlay`, `DataContext`, `ReportContext`, `useDeforestationReportDownload`, `deforestationImages.ts` and their tests, `usageHeaders.test.ts`)
- [x] 5.5 Update `apps/web/.env.template` (new names, drop the unused `..._PARSER_URL`) and the variable list in `apps/web/README.md`

## 6. Docs

- [x] 6.1 `CLAUDE.md`: remove the `analize` invariant and name `POST /layer_analysis/analyze` (`AnalyzeBody`) in the System map (design D7)
- [x] 6.2 `docs/onboarding.md`: routes, module path, client file and variable names, and remove the "spelled `analize`" gotcha
- [x] 6.3 `docs/architecture.md`, `docs/deforestation_calculation.md` and the `ReportProvider` line in `apps/web/README.md`: routes and module path
- [x] 6.4 `CHANGELOG.md` `[Unreleased]` → `### Changed`: the new routes and schemas, the old routes removed, and the renamed `NEXT_PUBLIC_LAYER_ANALYSIS_*_URL` overrides

## 7. Checks

- [x] 7.1 `git lfs pull`; in `apps/api`: `uv sync --frozen`, `uv run pytest`, `uv run ruff check .`, `uv run black --check .`, `uv run mypy app`, `uv run python -m app.openapi --check`. `tests/test_numeric_baseline.py` and the regression suite pass without regenerating
- [x] 7.2 In `apps/web`: `pnpm install --frozen-lockfile`, the `schema.d.ts` check, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test`, `pnpm run build`
- [x] 7.3 `git grep -n "analize\|deforestation_analysis\|DEFORESTATION_ANALYSIS_\|AnalizeBody\|FarmDeforestation"` outside `openspec/changes/archive` and the `CHANGELOG.md` history finds only the regression fallback, the 404 test and this change's own artifacts
- [x] 7.4 Run the API locally and call `/layer_analysis/analyze`, `/generate-image` and `/tiles` (200, with the `analysis` usage event) and the old routes (404); check that the built web bundle names only `/layer_analysis/*`. The click-through in the browser is left to the `dev` check after the merge (sub-issue acceptance criterion)

## 8. Archive

- [ ] 8.1 When archiving this change, update the `Purpose` of `openspec/specs/deforestation-analysis/spec.md` to name `POST /layer_analysis/analyze` instead of `POST /deforestation_analysis/analize`. A delta spec only changes requirements, so the archive leaves the `Purpose` as it was; fix it in the same commit as the archive
