## Context

`POST /farms/parse` validates each row (`parse_farms_validation`, `apps/api/app/modules/farms/validations.py:240-296`) into a `PreProcessedFarmData` whose `area: float` (`apps/api/app/models/farms.py:89-106`) comes from `validate_area` (`validations.py:199-222`). `validate_area` returns `FarmDefaults.DEFAULT_POINT_AREA_HECTARES` (1.0, `apps/api/app/config/constants.py:6`) when `not area`, which catches `None`, `""` and the number `0`, but not the string `"0"`: that one parses to `0.0` and yields a 0 m radius. `parse_base_information` (`apps/api/app/utils/farms.py:189-240`) turns a point's hectares into m² and a radius with `get_point_area_and_radius` (`apps/api/app/utils/polygons.py:165-178`) and returns a `PointSummary` (`apps/api/app/models/farms.py:9-14`). Polygon farms ignore `area`: their area is computed from the geometry (`farms.py:227`).

Once `validate_area` has replaced the missing area with the default, nothing downstream can tell an assumed area from a declared one.

## Goals / Non-Goals

**Goals:**
- 4 ha for a point whose area is missing, blank or zero (decision D6 of undp/monbo#192).
- A required `areaAssumed` boolean on `PointSummary` so the web can say so in the report.
- Regenerate the regression expectations for F05 only, and explain the diff in the PR.

**Non-Goals:**
- The web's use of the flag (report note, manual form preview, exports): change `point-assumed-area-web`.
- Flagging points over 4 ha: change `point-area-over-limit`.
- Rejecting a negative area explicitly. Today it fails in `math.sqrt` inside `parse_base_information` and comes back as a 400 `polygon-generation-error` (`farms.py:234-240`); that stays as it is.
- `docs/`: the `documenter` updates `docs/onboarding.md`, `docs/architecture.md` and `docs/polygon_area_calculation.md`.

## Decisions

1. **Where the default is applied.** `validate_area` returns `float | None`: `None` for a missing, blank or zero area (parsed value `== 0`), the parsed number otherwise. `PreProcessedFarmData.area` becomes `Optional[float] = None`. `parse_base_information` applies the default for points only: `assumed = farm.area is None`, hectares `= FarmDefaults.DEFAULT_POINT_AREA_HECTARES if assumed else farm.area`. *Alternative rejected:* returning `(area, assumed)` from `validate_area` and storing both on `PreProcessedFarmData`. It keeps a default meant for points on every polygon too, and spreads one fact over two fields.
2. **The constant.** `FarmDefaults.DEFAULT_POINT_AREA_HECTARES = 4.0`, with a comment citing TRACES and D6. The limit added by `point-area-over-limit` reuses the same number under its own name, since they mean different things (what TRACES assumes vs what art. 2(28) allows as a point).
3. **The contract.** `PointSummary.areaAssumed: bool`, no default, so it is required in the OpenAPI (and in the generated TypeScript). It is only on `PointSummary`: `PolygonShapeSummary` never assumes an area. `FarmPolygonDetailData` (what the web sends back to `/validate` and `/analyze`) does not change: those routes rebuild the circle from `details.radius`.
4. **Zero counts as missing.** Matches the web, which already reads `Area` `0`/`"0"` as missing on geo imports (`apps/web/src/utils/geoFile.ts:234-235`), and the issue's acceptance list ("punto con 0 → igual").

### API contract

- Route: `POST /farms/parse` (unchanged route, request and status codes).
- Response: each `FarmData.polygon` with `type: "point"` gains `areaAssumed: boolean` (required). Polygons unchanged.
- Data shape / migrations: N/A — there is no database; the web keeps `FarmData` in memory (`DataContext`).
- Cross-stack wiring: `pnpm contracts` regenerates `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`; `apps/web/src/interfaces/Farm.ts` re-exports the generated types, so no hand-written type changes.

### Signal trace — `areaAssumed`

- **Emitter:** `parse_base_information` (`apps/api/app/utils/farms.py`), on every point farm.
- **Consumer:** the web report's farm sheet (prints "Área supuesta: 4 ha, no declarada") and the exports (leave the area empty so a re-upload assumes it again), both in `point-assumed-area-web`.
- **State change:** none on the API; the web keeps it inside `FarmData` in `DataContext`.
- **External record:** the PDF report and the Excel/GeoJSON exports the user downloads.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/api/app/modules/farms/validations.py` | `not area` lets `"0"` through as 0.0, giving a 0 m circle; the new check must compare the parsed number, not the raw value | `validations.py:215-216` |
| `apps/api/app/models/farms.py` | A field with a default would be optional in the OpenAPI unless `json_schema_serialization_defaults_required` is set; `tests/test_openapi.py` checks required fields | `CLAUDE.md` "Code conventions", `models/farms.py:49-51` |
| `apps/api/app/utils/farms.py` | Exceptions here become a 400 for the whole upload; an `area is None` on a point must not reach `float(None)` | `farms.py:210`, `farms.py:234-240` |
| `apps/api/app/config/constants.py` | No known hazard | — |
| `apps/api/tests/regression/expected_results.json` | Regenerating it hides regressions if anything other than F05 moves; the generator also rewrites fixtures and the xlsx sheet | `tests/regression/generate.py:1-17`, `CLAUDE.md` "Testing" |
| `apps/api/tests/numeric_baseline/` | Must not change: it doesn't use points or `FarmDefaults` | `grep` of `tests/numeric_baseline/`, `tests/test_numeric_baseline.py` |
| `apps/api/openapi.json`, `apps/web/src/api/schema.d.ts` | CI fails both jobs when either is stale | `CLAUDE.md` "Code conventions" |

## Risks / Trade-offs

- [The regression diff is large: F05's fixtures and its overlap with F06 change] → The PR body lists exactly what moved for F05 (area 10,000 → 40,000 m², each layer's ratio before/after, the F05–F06 overlap) and states that no other farm changed. The coder checks it with a diff of the JSON restricted to non-F05 keys.
- [A 4 ha circle overlaps more neighbours than a 1 ha one] → Intended; it is the area TRACES will use.
- [Web clients deployed before the web change ignore `areaAssumed`] → Harmless: extra JSON field.
