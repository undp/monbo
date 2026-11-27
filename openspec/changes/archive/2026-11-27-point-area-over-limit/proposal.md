## Why

Under the EUDR, a plot of more than 4 ha used to produce a relevant commodity other than cattle must be geolocated with a polygon, not a point (Reg. (EU) 2023/1115, art. 2(28)). Monbo accepts a point of any declared area and analyses it as a circle, so a 10 ha point goes through stage 1 as "Listo" and reaches the report as if its geolocation were acceptable (undp/monbo#202).

## What Changes

- `POST /polygons_validation/validate` reports a new inconsistency, `point_area_over_limit`, for a point farm whose area (from its radius) is over 4 ha, with the area and the limit in hectares. The farm is `NOT_VALID`.
- On stage 1 it is a geometry error: the row says "Punto de 5 ha: más de 4 ha se declara como polígono", "Revisar" opens the informational modal (no manual validation), and the Excel export names the type.
- Contract change: a new member of the `PolygonInconsistency` discriminated union. `openapi.json` and `schema.d.ts` are regenerated in the same commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `polygon-validation`: a point over 4 ha is an inconsistency.
- `validation-results`: the new inconsistency is a geometry error in the status column.

## Impact

- API: `app/config/constants.py`, `app/modules/polygons_validation/{models,helpers,router}.py`, `tests/modules/test_polygons_validation.py`.
- Contract: `apps/api/openapi.json`, `apps/web/src/api/schema.d.ts`.
- Web: `components/page/polygonsValidation/ValidationResultsTable.tsx`, `components/page/polygonsValidation/GeometryInconsistencyModal.tsx`, `interfaces/PolygonValidation.ts` (comment), `locales/{es,en}/polygonValidation.json`, and their tests.
- Conflicts: EUDR-8 (undp/monbo#200) adds its own inconsistency type in the same files and the same `validation-results` requirement; EUDR-11 (#203) too. The second to merge rebases.
