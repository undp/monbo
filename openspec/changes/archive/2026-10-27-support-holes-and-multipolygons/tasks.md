## 1. Failing tests first

- [x] 1.1 API tests that fail on the current code:
  - parse a GeoJSON and a WKT polygon with a hole: same part, hole and area;
  - parse a WKT and a GeoJSON MultiPolygon, declared as `"Polygon"` and as `"MultiPolygon"`;
  - parse a point declared as `"Polygon"` (rejected) and a `LINESTRING` (rejected);
  - every ring returned is oriented: exterior counter-clockwise, holes clockwise;
  - `center` is the centroid for a convex farm, and lies inside a ring-shaped farm and inside one part of a two-part farm.
- [x] 1.2 API tests for the analysis and the validation, with farms as `/farms/parse` returns them:
  - a ratio of 0 when the only loss is inside the hole;
  - 0.25 for loss covering half of one of two equal parts;
  - one part outside the raster;
  - `invalid_geometry` for a hole outside its exterior and for overlapping parts;
  - no overlap for a farm inside another's hole;
  - an overlap whose `parts` carry a hole.
- [x] 1.3 API tests for image bounds: one image contains every vertex of two parts 5 km apart, and a hole's outline is drawn in the outline colour.

## 2. API contract and conversion

- [x] 2.1 `app/models/polygons.py`: add `PolygonPart {exterior, holes}`, and replace `PolygonDetails.path` with `parts: list[PolygonPart]`. In `polygons_validation/models.py`, replace `OverlapData.paths` with `parts: list[PolygonPart]`.
- [x] 2.2 `app/utils/polygons.py`: add `geometry_to_parts` (orients each part with `orient(sign=1.0)`), `parts_to_geometry` (`Polygon` for one part, `MultiPolygon` for several), and the center rule (the centroid if the geometry contains it, else `representative_point()`). `generate_polygon` delegates to them for polygons and keeps the point buffer.
- [x] 2.3 Update the annotations that say `Polygon` to `Polygon | MultiPolygon` where a farm can be either. This covers `FarmPolygonDetailDataWithPolygon`, the helpers and `GeometryCalculator.calculate_polygon_area` if it narrows the type. `mypy app` stays clean.

## 3. API parsing

- [x] 3.1 `app/utils/farms.py`: the WKT and GeoJSON parsers return a Shapely geometry. WKT is classified by its type. GeoJSON is classified by its depth: 1 is a Point, 3 a Polygon, 4 a MultiPolygon. Remove `HOLES_NOT_SUPPORTED` and its checks.
- [x] 3.2 `InputFarmData.geometryType` and `PreProcessedFarmData.geometryType` accept `"MultiPolygon"`. The point vs polygonal mismatch is rejected; `"Polygon"` and `"MultiPolygon"` are interchangeable. `PreProcessedFarmData.farmCoordinates` carries what the parser returns (the geometry for polygons, the center for points).
- [x] 3.3 `parse_base_information` and `get_farm_coords_and_radius` build and read `parts` through the conversion module. No module reads `.exterior` outside it: check with `grep -rn "\.exterior" apps/api/app`.

  `get_farm_coords_and_radius` became `build_farm_geometry`. It raises `FarmDetailsMismatchError` (a `ValueError`) when the type and details disagree, so validation can still answer 400. Outside the conversion module, only `GeometryHelper` reads `.exterior`, and it draws every exterior and every hole.

## 4. API validation and analysis

- [x] 4.1 `polygons_validation`: `get_geometry_paths` becomes `geometry_to_parts` for overlaps. The router builds farm geometries with `parts_to_geometry`. Tests from 1.2 pass.
- [x] 4.2 `deforestation_analysis/router.py`: build the farm geometry with `parts_to_geometry`. Confirm `get_loss_area_fraction` needs no change. Tests from 1.2 pass.

## 5. API report images

- [x] 5.1 `GeometryHelper`:
  - bounds from `geom.bounds`;
  - reprojection with `shapely.ops.transform`;
  - `validate_geometry_parameters` accepts `MultiPolygon`;
  - drawing loops over parts and holes, with the fill drawn on a mask (exteriors filled, holes cleared) before compositing above the deforestation.
- [x] 5.2 `/generate-image` accepts a `MultiPolygon` feature. Tests from 1.3 pass, and the existing image tests (tall, wide, outline above loss) still pass.

## 6. Contracts and regression

- [x] 6.1 `pnpm contracts`: regenerate `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts`. `python -m app.openapi --check` passes.
- [x] 6.2 Regenerate `tests/regression` and `tests/numeric_baseline` expectations for the new contract. Confirm that the area, ratios, overlap results and center of the existing farms are unchanged.

  Nothing to regenerate:
  - neither expectation stores paths, and both suites pass unchanged, so area, ratios and overlaps are the same;
  - a check over the regression farms gives every polygon farm's center equal to its centroid, as before.

## 7. Web

- [x] 7.1 `components/reusable/Map.tsx`: `PolygonObject.parts` replaces `path`. Render one `google.maps.Polygon` per part with `setPaths([exterior, ...holes])`, sharing the colour and `onClick`. Bounds extend over every exterior. `showPoints` covers every ring.
- [x] 7.2 `SelectedPolygonsMap.tsx`, `PolygonDetailModal.tsx`, `GeometryInconsistencyModal.tsx` and `OverlapInconsistencyModal.tsx` read `details.parts` (and `data.parts` for overlaps). Vertex tables add a part / ring column only when the farm has more than one ring. New copy goes in `locales/es` and `locales/en`.

  The part and ring are a label in the vertex number's cell, from `getPolygonVertices` in `utils/polygons.ts`, not a new column (see design decision 7).
- [x] 7.3 `utils/excel.ts`:
  - `validGeometryTypes` adds `"MultiPolygon"`;
  - the WKT regex accepts `MULTIPOLYGON`;
  - the GeoJSON check accepts Polygon (depth 3) and MultiPolygon (depth 4) arrays, reviving `validateGeoJSONMultiPolygonCoordinates`, for both polygonal geometry types.

  Add Vitest tests.
- [x] 7.4 `utils/geojson.ts`: `Polygon` with `[exterior, ...holes]` for one part, `MultiPolygon` for several. `utils/download.ts`: the coordinates cell writes the full GeoJSON array with holes and parts, and the geometry type cell writes `Polygon` or `MultiPolygon`. A cell over 32,767 characters is reported instead of being truncated. Vitest tests cover both exports, plus a round trip through the Excel loader.
- [x] 7.5 `pnpm --dir apps/web lint`, type-check and `test` pass.

## 8. End-to-end check

- [x] 8.1 Run the app locally. Upload an Excel with a polygon with a hole, a MultiPolygon declared as `"Polygon"`, and a simple polygon. Check:
  - the maps draw the hole empty and both parts;
  - the validation;
  - a deforestation analysis;
  - a report image with all parts;
  - the GeoJSON and Excel exports, the Excel uploaded again with the same results.

  Save screenshots in `.context/`.

  Done with Playwright and the real Google Maps in `.context/e2e-holes/`:
  - the validation (4 farms valid), the detail of F-001 (hole) and F-002 (two parts, vertices labelled by part and ring);
  - the GFW analysis, and the map with F-001 filled and its hole empty;
  - `/generate-image` for both, with the hole outlined and not filled, and both parts in one image;
  - the GeoJSON (`Polygon` with 2 rings, `MultiPolygon` with 2 parts) and Excel downloads, the Excel uploaded again with no errors.
- [x] 8.2 Upload the same farms with clockwise rings, and check the holes are still drawn empty on Google Maps.

  `fincas_huecos_horario.xlsx` (clockwise exterior, counter-clockwise hole): the hole is empty on the map, as with the oriented file.

## 9. Docs

- [x] 9.1 `docs/architecture.md`: describe the farm's geometry (parts, holes, orientation, center), and point to the conversion module.
- [x] 9.2 CHANGELOG: "Added" for holes and MultiPolygons; "Changed" for the overlap `parts` in the contract. Resolve the design's open questions (the template instructions and the parts label) and record the outcome.
