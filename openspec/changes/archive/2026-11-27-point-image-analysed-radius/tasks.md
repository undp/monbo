Group 1 (API and contracts) and group 2 (web) write disjoint files; group 2 needs the regenerated `schema.d.ts`.

## 1. API: the radius in the body

Files: apps/api/app/modules/layer_analysis/router.py, apps/api/tests/modules/layer_analysis/test_router.py, apps/api/openapi.json, apps/web/src/api/schema.d.ts

- [x] 1.1 Tests first in `test_router.py`, with `MapImageGenerator.generate`, `get_map_by_id` and `get_map_raster_path` patched as in `test_generate_image_checks_the_analysed_version`:
  - fix tripwire: a Point feature with `pointRadiusMeters: 112.84` → 200, and `generate` was called with `112.84` as the radius;
  - fix tripwire: a Point feature without `pointRadiusMeters` → 400, `generate` not called;
  - regression guards: `pointRadiusMeters` `0`, `-1` and `10001` → 422; a polygon feature with `pointRadiusMeters: 112.84` → 200 and `generate` called without a radius.
  Minimal mutants: `--find "body.pointRadiusMeters" --replace "50"` (first occurrence in the call) turns the 112.84 tripwire red; `--find "le=10_000" --replace "le=100_000"` turns the 10001 guard red.
- [x] 1.2 `router.py`: `pointRadiusMeters` on `GenerateImageBody` with `Field(default=None, gt=0, le=10_000)` and a comment; in `generate_image`, a point without it → `HTTPException(400, ...)` before any raster work; pass it to `MapImageGenerator.generate`; remove the 50 m TODO.
- [x] 1.3 `pnpm contracts`; commit `openapi.json` and `schema.d.ts`.
- [x] 1.4 From `apps/api`: `uv run pytest tests/modules/layer_analysis tests/modules/layers tests/test_openapi.py`, ruff, black, mypy green.

## 2. Web: send the analysed radius

Files: apps/web/src/api/layerAnalysis.ts, apps/web/src/utils/layerImages.ts, apps/web/src/utils/layerImages.test.ts

- [x] 2.1 Tests first in `layerImages.test.ts` (fix tripwire): `fetchFarmImages` for a point farm with `radius: 112.84` sends `pointRadiusMeters: 112.84` in every request body; for a polygon farm the body has no `pointRadiusMeters`. Add the same check for `fetchLayerImages` with one point farm. Minimal mutant: in `layerImages.ts`, `--find "farm.polygon.details.radius" --replace "undefined"`.
- [x] 2.2 `layerAnalysis.ts`: `generateLayerImage` takes the radius and sets `pointRadiusMeters` in the typed body. `layerImages.ts`: `pointRadiusMeters(farm)` helper; both call sites pass it.
- [x] 2.3 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` green.
