## Why

The layer manager (#116) left two pieces of API debt (orchestration #172, unit MB-7, issue #173): a dead model in the analysis module, and an open question about whether `GET /countries` pays too much for checking every layer's raster on the Azure Files share. The question needs a measurement before anyone adds a cache to a guard that exists for audit safety.

## What Changes

- Remove `DeforestationUnprocessedFarmData` from `apps/api/app/modules/layer_analysis/models.py`. Nothing imports it, and it is not part of `openapi.json`.
- Close the `has_raster` cache question with a measurement (recorded in `design.md` and the PR): **no cache**. On dev, `GET /countries` costs about 45 ms more than `/health/live` at the median, of which `has_raster` accounts for at most ~20 ms. A cache keyed by the index would break the stated guarantee that a raster removed from the share by hand stops being listed.
- Pin that guarantee with a regression test: a raster removed from disk, with the index untouched, disappears from `GET /maps` and `GET /countries` on the next request.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layer-storage`: the public listing requirement gains a scenario stating that the raster check is made on every listing, so a raster removed after a previous listing is hidden on the next one without any index change. The requirement text itself does not change.

## Impact

- `apps/api/app/modules/layer_analysis/models.py` (deletion of an unused class).
- `apps/api/tests/modules/layers/test_countries_layout.py` (one new test).
- No contract change: `openapi.json` and `schema.d.ts` stay as they are. No change to responses, so `GET /countries` answers byte for byte as before.

## Non-goals

- Any cache of `has_raster`, or of the other `stat` calls a listing makes (`is_per_country`, `read_registry`, `read_index`, `read_categories`).
- Removing the regression fallback to `/deforestation_analysis/analize` (MB-10, #170, part B).
- Index field type validation (MB-3, #165, already merged in #176).
