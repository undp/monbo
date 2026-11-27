Group 1 (API and contracts) and group 2 (web) write disjoint files; group 2 needs the regenerated `schema.d.ts` of group 1.

## 1. API: the inconsistency

Files: apps/api/app/config/constants.py, apps/api/app/modules/polygons_validation/models.py, apps/api/app/modules/polygons_validation/helpers.py, apps/api/app/modules/polygons_validation/router.py, apps/api/tests/modules/test_polygons_validation.py, apps/api/openapi.json, apps/web/src/api/schema.d.ts

- [x] 1.1 Tests first in `tests/modules/test_polygons_validation.py`, through `POST /polygons_validation/validate`:
  - fix tripwire: a point with radius 126.16 (5 ha) → one `point_area_over_limit` inconsistency with `data == {"areaHectares": 5.0, "maxAreaHectares": 4.0}`, status `NOT_VALID`;
  - regression guards: a point with radius 112.84 (4 ha, also the default) → no such inconsistency, status `VALID`; a 54 ha square polygon → none; a 5 ha point that also overlaps a polygon → both the overlap and the new inconsistency are reported.
  Minimal mutants: `--find "radius > " --replace "radius >= "` in `helpers.py` turns the 4 ha guard red; `--find "MAX_POINT_AREA_HECTARES = 4.0" --replace "MAX_POINT_AREA_HECTARES = 5.0"` turns the 5 ha tripwire red.
- [x] 1.2 `constants.py`: `FarmDefaults.MAX_POINT_AREA_HECTARES = 4.0`, comment citing Reg. (EU) 2023/1115 art. 2(28).
- [x] 1.3 `models.py`: `PointAreaOverLimitData`, `PointAreaOverLimitInconsistency`, added to `PolygonInconsistency`.
- [x] 1.4 `helpers.py`: `get_point_area_inconsistencies(farms)` comparing `details.radius` with the rounded 4 ha radius (`get_point_area_and_radius`), data rounded to 2 decimals; docstring. `router.py`: add its result to `all_inconsistencies`; update the route docstring.
- [x] 1.5 `pnpm contracts`; commit `openapi.json` and `schema.d.ts`.
- [x] 1.6 From `apps/api`: `uv run pytest tests/modules/test_polygons_validation.py tests/regression tests/test_openapi.py`, ruff, black, mypy green. The regression snapshot must not change.

## 2. Web: show it as a geometry error

Files: apps/web/src/components/page/polygonsValidation/ValidationResultsTable.tsx, apps/web/src/components/page/polygonsValidation/GeometryInconsistencyModal.tsx, apps/web/src/interfaces/PolygonValidation.ts, apps/web/src/locales/es/polygonValidation.json, apps/web/src/locales/en/polygonValidation.json, apps/web/src/components/page/polygonsValidation/ValidationResultsTable.test.tsx, apps/web/src/utils/validationResults.test.ts

- [x] 2.1 Tests first (fix tripwires): in `ValidationResultsTable.test.tsx`, a point with a `point_area_over_limit` inconsistency (`areaHectares: 5`) reads "Punto de 5 ha: más de 4 ha se declara como polígono", and its "Revisar" opens the modal with the art. 2(28) sentence and no manual-validation control; in `validationResults.test.ts`, its view's `kind` is `geometryError` and `matchesResultsFilter(view, "error")` is true. Minimal mutant: in `ValidationResultsTable.tsx`, `--find "point_area_over_limit" --replace "point_area_over_limit_x"` (one occurrence) turns the status test red.
- [x] 2.2 Locales (both): `inconsistenciesTypes.point_area_over_limit`, `results.status.pointAreaOverLimit`, `geometryInconsistencyModal.pointAreaOverLimit`, texts as in design.md, in their own block.
- [x] 2.3 `ValidationResultsTable.tsx` `geometryErrorText`: handle the new type before reading `data.reason`, formatting the area for the language. `GeometryInconsistencyModal.tsx`: for this type, show the explanation instead of the system feedback; keep `reason` for the others, narrowing by `type`. `interfaces/PolygonValidation.ts`: update the comment listing the types.
- [x] 2.4 From `apps/web`: `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm test` green.
