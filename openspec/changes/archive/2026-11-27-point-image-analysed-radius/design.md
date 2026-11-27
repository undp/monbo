## Context

`generate_image` (`apps/api/app/modules/layer_analysis/router.py:161-200`) reads `GenerateImageBody` (`:150-157`: `feature`, `mapId`, `country`, `version`), builds the Shapely geometry, and for a `Point` calls `MapImageGenerator.generate(geom, raster_path, point_radius_meters, ...)` with `point_radius_meters = 50` (`:183-190`). `MapImageGenerator`/`GeometryHelper` already validate the parameter: required for a point, rejected for a polygon (`apps/api/app/utils/image_generation/GeometryHelper.py:36-70`).

On the web, `generateLayerImage` (`apps/web/src/api/layerAnalysis.ts:78-109`) posts `{country, mapId, feature, version}`. It is called by `fetchFarmImages` (`apps/web/src/utils/layerImages.ts:102-145`) and `fetchLayerImages` (`:148-204`), both of which have the `FarmData`, whose point `polygon.details.radius` is the radius the analysis used (`/analyze` rebuilds the circle from it, `apps/api/app/utils/farms.py:53-54`).

## Goals / Non-Goals

**Goals:**
- The image of a point draws the analysed circle.

**Non-Goals:**
- Changing the image's framing, size or styles.
- Deriving the radius on the API from GeoJSON properties: the feature's properties are the EUDR export properties, not a contract for the image.

## Decisions

1. **Body field.** `pointRadiusMeters: float | None = Field(default=None, gt=0, le=10_000)`. Request model, so no `json_schema_serialization_defaults_required` is needed. The cap bounds the raster window a public request can ask for with a single number (10 km ≈ 31,400 ha; any real point is far below). Out of range → FastAPI's 422.
2. **Missing for a point → 400.** `HTTPException(400, "pointRadiusMeters is required for a point")`, raised before any raster work. *Alternative rejected:* falling back to 50 m or to the 4 ha radius: either would draw a circle that may not be the analysed one, which is the bug being fixed.
3. **Ignored for polygons.** The route passes it only for points, as today. Sending it for a polygon is not an error, so the web can send the farm's radius without branching on the feature type in two places.
4. **Web.** A helper `pointRadiusMeters(farm)` in `layerImages.ts` returns `farm.polygon.details.radius` for a point and `undefined` otherwise. `generateLayerImage` takes it as an extra optional parameter (after `feature`, as an options object if the positional list becomes unreadable) and sets it in the body; both callers pass it.

### API contract

- Route: `POST /layer_analysis/generate-image?include_satelital_background=<bool>`.
- Request: `GenerateImageBody` + `pointRadiusMeters?: number` (0 < x ≤ 10,000).
- Response: unchanged JPEG. Status codes: 400 (point without radius, new), 404, 409, 422 (out-of-range radius, via validation).
- Data shape / migrations: N/A.
- Cross-stack wiring: `pnpm contracts`; the web builds the body typed as `components["schemas"]["GenerateImageBody"]`, so the field is checked by `tsc`.

### Signal trace

N/A — no new marker or state: a request parameter that carries an existing value.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/api/app/modules/layer_analysis/router.py` | Public route without auth: an unbounded radius asks for an arbitrarily large raster window; the 400 must come before `run_in_threadpool` work and `NoRasterDataOverlapError` handling must stay | `router.py:161-200`, `CLAUDE.md` "Security" |
| `apps/api/tests/modules/layer_analysis/test_router.py` | Existing image tests post a polygon (`GENERATE_IMAGE_FEATURE`) and must keep passing unchanged | `test_router.py:355-400` |
| `apps/web/src/api/layerAnalysis.ts` | Positional parameters; adding one in the wrong place shifts `version`/`signal` | `layerAnalysis.ts:78-85` |
| `apps/web/src/utils/layerImages.ts` | Two call sites; missing one leaves point images failing with 400 in the large-report path | `layerImages.ts:133-141`, `:186-195` |

## Risks / Trade-offs

- [A tab opened before the deploy sends no radius and gets a 400 for point images] → Web and API ship in the same release (train 1 of undp/monbo#192); the report's retry/stale flows ask for a reload. Accepted.
- [Larger circles zoom the image out] → Intended: it shows the analysed area.
