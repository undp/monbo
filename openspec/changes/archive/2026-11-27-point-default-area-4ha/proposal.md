## Why

A farm given as a point without an area is analysed as a 1 ha circle (`FarmDefaults.DEFAULT_POINT_AREA_HECTARES = 1.0`, `apps/api/app/config/constants.py:6`, applied by `validate_area` in `apps/api/app/modules/farms/validations.py:215-216`). TRACES, the EU information system, assigns 4 ha to a point without `Area` ([GeoJSON File Description](https://eudr.webcloud.ec.europa.eu/tracesnt/help/eudr-documentation/operator/geojson-description.html)), and the orchestration decided to follow it (undp/monbo#192, decision D6). Nothing in the response says that the area was assumed rather than declared, so the report can't tell the reader either (undp/monbo#202).

## What Changes

- A point farm whose area is missing, blank or zero is analysed as 4 ha (radius √(40,000 / π) ≈ 112.84 m) instead of 1 ha.
- `POST /farms/parse` marks such a point: `PointSummary` gets a required boolean `areaAssumed`, true when the API supplied the default area, false when the farm declared one. Contract change: `openapi.json` and `apps/web/src/api/schema.d.ts` are regenerated in the same commit.
- `apps/api/tests/regression/expected_results.json` (and its fixtures) is regenerated on purpose: F05, the only regression farm that is a point without an area, grows from 1 ha to 4 ha, so its area, its ratios and its overlap with F06 change. Nothing else may move. The numeric baseline (`tests/test_numeric_baseline.py`) must stay green without being regenerated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deforestation-analysis`: adds the 4 ha default for a point without an area, and the `areaAssumed` mark that says so.

## Impact

- API: `app/config/constants.py`, `app/modules/farms/validations.py`, `app/models/farms.py`, `app/utils/farms.py`.
- Contract: `PointSummary.areaAssumed` (new, required). `apps/api/openapi.json`, `apps/web/src/api/schema.d.ts`. The web consumes the flag in `point-assumed-area-web`; until then the web's test factories don't typecheck, which is fine for an intermediate commit (squash merge).
- Regression suite: `tests/regression/expected_results.json`, `tests/regression/fixtures/`, the "Resultados esperados" sheet of `regression_farms.xlsx`.
- Docs that state 1 ha (`docs/onboarding.md:83`, `docs/architecture.md:244`, `docs/polygon_area_calculation.md:36-38`) are updated by the `documenter`, not by this change.
