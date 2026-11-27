## Why

The analysis measures a point as the circle of its area (radius √(A/π), `apps/api/app/utils/polygons.py:165-178`), but `POST /layer_analysis/generate-image` draws every point with a fixed 50 m radius (`apps/api/app/modules/layer_analysis/router.py:185`, a TODO). A 4 ha point is analysed over 112.84 m and drawn over 50 m: the report's image doesn't show the area whose ratio it prints (undp/monbo#202).

## What Changes

- `GenerateImageBody` gets `pointRadiusMeters` (meters, > 0, ≤ 10,000). It is required when the feature is a point (400 otherwise) and ignored for polygons. The fixed 50 m goes away.
- The web sends each point farm's `polygon.details.radius` (the analysed radius) with every image request: the report's preview, the PDF/ZIP build and the per-farm fetch.
- Contract change: `openapi.json` and `schema.d.ts` regenerated in the same commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-generation`: a point's image draws the circle that was analysed.

## Impact

- API: `app/modules/layer_analysis/router.py`, `tests/modules/layer_analysis/test_router.py`.
- Contract: `apps/api/openapi.json`, `apps/web/src/api/schema.d.ts`.
- Web: `api/layerAnalysis.ts`, `utils/layerImages.ts`, `utils/layerImages.test.ts`.
- Deploy: API and web ship together in the same release; a browser tab opened before the deploy would get a 400 for point images until it reloads (polygons are unaffected).
