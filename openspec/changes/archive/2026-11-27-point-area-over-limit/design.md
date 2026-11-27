## Context

`POST /polygons_validation/validate` (`apps/api/app/modules/polygons_validation/router.py:19-112`, prefix in `__init__.py:8`) receives `FarmPolygonDetailData` (id, type, details) — no declared area. A point's area is only in its `details.radius`, which `/farms/parse` rounded to 2 decimals (`apps/api/app/utils/polygons.py:165-178`). The router builds each farm's geometry, then concatenates overlap, geometry and unbuildable-ring inconsistencies (`router.py:81-90`) and marks every farm in any of them `NOT_VALID` (`:92-101`). The inconsistency types are a discriminated union on `type` (`models.py:17-44`).

On the web, every inconsistency whose `type` isn't `overlap` is a `GeometryInconsistency` (`apps/web/src/utils/validationResults.ts:12-15`): its row is a geometry error, first in the status order, and its "Revisar" opens `GeometryInconsistencyModal` without manual validation (`validation-results` spec, "A geometry error can't be validated manually"). The status text comes from `geometryErrorText` (`ValidationResultsTable.tsx:51-65`), which reads `data.reason` after handling `empty_polygon`; the modal prints `row.data.data.reason` when present (`GeometryInconsistencyModal.tsx:305-310`). The Excel export names a type with `polygonValidation:inconsistenciesTypes:<type>` (`apps/web/src/utils/resultsExport.ts:129`).

## Goals / Non-Goals

**Goals:**
- Flag points over 4 ha (art. 2(28)) in stage 1, as a geometry error.

**Non-Goals:**
- The cattle exception of art. 2(28) (plots for cattle may be points): Monbo doesn't know the commodity in a way the API can trust (`cropType` is free text). Recorded as a risk.
- Excluding the farm from the analysis and listing it in the report's excluded section: EUDR-8 (undp/monbo#200) does that for every `NOT_VALID` farm. If EUDR-8 merges first, the rebase adds this type's reason text to its excluded-farms section.
- Splitting or converting the point.

## Decisions

1. **Judged from the radius, against the rounded 4 ha radius.** π·112.84² = 40,001.6 m², so comparing the recomputed area with 40,000 m² would flag every point declared as exactly 4 ha and every assumed one. The check is `radius > get_point_area_and_radius(FarmDefaults.MAX_POINT_AREA_HECTARES)[1]` (112.84). A new constant `FarmDefaults.MAX_POINT_AREA_HECTARES = 4.0` (art. 2(28)), separate from the default.
2. **Data.** `PointAreaOverLimitData { areaHectares: float; maxAreaHectares: float }`, `areaHectares = round(π·r² / 10,000, 2)`. Hectares, not m², because the web prints them as is and the limit is stated in hectares. A new `PointAreaOverLimitInconsistency { type: Literal["point_area_over_limit"]; farmIds; data }` joins the union.
3. **A geometry error, not a reviewable warning.** It reuses the web's geometry-error path (status, modal, KPI "error", filters, exclusion by EUDR-8) without a new kind. *Alternative:* an overlap-like warning that can be validated manually. Rejected by default because the rule is a "must" and the web has no warning kind besides overlaps; it is the open question of Puerta 1.
4. **Helper.** `get_point_area_inconsistencies(farms)` in `helpers.py`, called from the router next to the others. The point still goes through the overlap check.
5. **Web text.** `geometryErrorText` handles the new type before reading `data.reason` (which it doesn't have); the modal shows, for this type, a sentence with the area and the limit instead of the "system feedback". New keys, in their own block per locale:
   - `inconsistenciesTypes.point_area_over_limit`: "Punto de más de 4 ha" / "Point over 4 ha"
   - `results.status.pointAreaOverLimit`: "Punto de {{area}} ha: más de 4 ha se declara como polígono" / "{{area}} ha point: over 4 ha must be declared as a polygon"
   - `geometryInconsistencyModal.pointAreaOverLimit`: "Este punto declara {{area}} ha. Una parcela de más de {{max}} ha debe declararse como polígono (Reglamento (UE) 2023/1115, art. 2(28))." / "This point declares {{area}} ha. A plot of more than {{max}} ha must be declared as a polygon (Regulation (EU) 2023/1115, art. 2(28))."

### API contract

- Route: `POST /polygons_validation/validate`, request unchanged, status codes unchanged (200; 400 for a type/details mismatch).
- Response: `inconsistencies[]` may contain `{ "type": "point_area_over_limit", "farmIds": [id], "data": { "areaHectares": number, "maxAreaHectares": number } }`.
- Data shape / migrations: N/A — no database.
- Cross-stack wiring: `pnpm contracts`; the web's `InconsistentPolygonData` is generated, so the new member reaches `GeometryInconsistency` on its own.

### Signal trace — `point_area_over_limit`

- **Emitter:** `get_point_area_inconsistencies` (API).
- **Consumer:** `farmValidationViews` (kind `geometryError`), `ValidationResultsTable` (status text), `GeometryInconsistencyModal` (explanation), the inconsistencies sheet of the Excel export; later, EUDR-8's exclusion from the analysis.
- **State change:** the farm becomes `NOT_VALID` and counts in the KPI "error" and in the usage event's `invalidFarms` (a count, no farm data).
- **External record:** stage 1 table and modal, and the Excel export.

## Hazards (Step 2b)

| File | Failure mode | Evidence |
|---|---|---|
| `apps/api/app/modules/polygons_validation/models.py` | The union must stay discriminated or the generated TS loses narrowing | `models.py:40-44`, `CLAUDE.md` "Code conventions" |
| `apps/api/app/modules/polygons_validation/helpers.py` | Rounding: comparing areas instead of radii flags exact 4 ha points | Decision 1 |
| `apps/api/app/modules/polygons_validation/router.py` | Results are looked up by farm id; a farm whose ring can't be built is skipped from `farms_polygons` | `router.py:49-75` |
| `apps/api/app/config/constants.py` | No known hazard | — |
| `apps/api/tests/regression/pipeline.py` | Reads `percentage/criticality/area/reason` from each inconsistency's data; no regression farm is over 4 ha (F04 is exactly 4), so the snapshot doesn't change | `pipeline.py:200-210`, `expected_results.json` |
| `apps/web/src/components/page/polygonsValidation/ValidationResultsTable.tsx` | `inconsistency.data.reason` no longer typechecks for every geometry inconsistency | `ValidationResultsTable.tsx:56-58` |
| `apps/web/src/components/page/polygonsValidation/GeometryInconsistencyModal.tsx` | Same, `row.data.data.reason` | `:305-310` |
| `apps/web/src/locales/{es,en}/polygonValidation.json` | Parity test | `CLAUDE.md` "Testing" |
| All of the above | EUDR-8 and EUDR-11 add types in the same places; the second to merge rebases, including the `validation-results` delta | undp/monbo#192, "Conflictos" |

## Risks / Trade-offs

- [Cattle plots may legally be points over 4 ha] → Monbo's countries upload coffee and cocoa today; if a cattle case appears, the decision can move to a warning. Asked at Puerta 1.
- [A user can't validate the point manually] → Intended under decision 3: the fix is to upload the polygon.
