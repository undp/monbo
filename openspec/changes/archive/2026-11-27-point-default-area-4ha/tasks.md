Groups 1 and 2 write disjoint files (API code and contracts vs regression data); group 2 runs after group 1 because it uses the new default.

## 1. Default area and the `areaAssumed` mark

Files: apps/api/app/config/constants.py, apps/api/app/modules/farms/validations.py, apps/api/app/models/farms.py, apps/api/app/utils/farms.py, apps/api/openapi.json, apps/web/src/api/schema.d.ts, apps/api/tests/modules/farms/test_point_area.py, apps/api/tests/modules/layer_analysis/test_router.py

- [x] 1.1 Write `apps/api/tests/modules/farms/test_point_area.py` first (fix tripwires, red before 1.2–1.5), posting to `/farms/parse` with `TestClient`:
  - a point with no `area` → `polygon.area == 40000.0`, `polygon.details.radius == 112.84`, `polygon.areaAssumed is True`;
  - parametrized `area` in `None`, `""`, `0`, `"0"`, `"0,0"` (locale `es`) → same as above;
  - a point with `area` `2.5` → `polygon.area == 25000.0`, `areaAssumed is False`;
  - a polygon farm with any `area` → its `polygon` has no `areaAssumed` key.
  Minimal mutants (run with `falsify.mjs` on the post-change tree): `--find "DEFAULT_POINT_AREA_HECTARES = 4.0" --replace "DEFAULT_POINT_AREA_HECTARES = 1.0"` (turns the 4 ha tests red); in `validations.py`, the zero check (e.g. `--find "== 0" --replace "== -1"`, adapted to the exact text written) turns the `"0"` case red.
- [x] 1.2 `constants.py`: `DEFAULT_POINT_AREA_HECTARES = 4.0`, with a comment: the area TRACES assigns to a point without one (D6 of undp/monbo#192).
- [x] 1.3 `validations.py`: `validate_area` returns `float | None`; `None` when the value is missing, blank or parses to 0; still a 400 chained `from exc` when it can't be parsed. Update its docstring. `models/farms.py`: `PreProcessedFarmData.area: Optional[float] = None`.
- [x] 1.4 `models/farms.py`: `PointSummary.areaAssumed: bool` (required, no default), with a one-line comment. `utils/farms.py` `parse_base_information`: for a point, `assumed = farm.area is None`, hectares from the default when assumed, and pass `areaAssumed=assumed`.
- [x] 1.5 Update `test_parse_farms` in `apps/api/tests/modules/layer_analysis/test_router.py:140-208`: the expected point gets `"areaAssumed": True` and keeps deriving area and radius from `FarmDefaults.DEFAULT_POINT_AREA_HECTARES`.
- [x] 1.6 `pnpm contracts` from the root; commit `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`. Check `PointSummary.areaAssumed` is in `required`.
- [x] 1.7 From `apps/api`: `uv run pytest tests/modules/farms tests/modules/layer_analysis tests/test_openapi.py`, `uv run ruff check .`, `uv run black --check .`, `uv run mypy app` green.

## 2. Regression expectations for F05

Files: apps/api/tests/regression/expected_results.json, apps/api/tests/regression/fixtures/**, apps/api/tests/regression/regression_farms.xlsx

- [x] 2.1 Confirm the rasters are real files, not LFS pointers (`git lfs pull` if needed), then from `apps/api` run `uv run python -m tests.regression.generate`.
- [x] 2.2 Check the diff: in `expected_results.json` only F05 entries change (its `area_m2` 10000.0 → 40000.0, its per-layer ratios, the F05–F06 overlap and, if it changes, F05's validation status); every other farm's values are identical. Write the before/after table for F05 in your final report so the shipper puts it in the PR body ("Por qué cambia la regresión").
- [x] 2.3 `uv run pytest tests/regression tests/test_numeric_baseline.py` green **without touching `tests/numeric_baseline/`**. If the numeric baseline goes red, stop and report `PLAN CONFLICT:`: regenerating it is the bug.
- [x] 2.4 Full API suite: `uv run pytest` green.
