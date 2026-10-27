## Context

Monbo is stateless. `/farms/parse` returns each farm with its geometry, and the web keeps it in memory. The web then sends the farm back on every call: `/polygons_validation/validate`, `/deforestation_analysis/analize`, and `/generate-image`, which receives the farm as a GeoJSON feature. Today a polygon travels as `PolygonDetails.path: list[Coordinates]`, one ring, and the API rebuilds it with `generate_polygon(path)`. Holes are rejected at parsing (`HOLES_NOT_SUPPORTED`, added by `fix-polygon-edge-cases`) because the path can't carry them. MultiPolygons can't be expressed at all.

The geometry maths is already general. Area (`GeometryCalculator`), the deforestation ratio (`get_loss_area_fraction`: pixel squares intersected with the geometry), overlaps (`polygonal_part`) and `is_valid` all work on any Shapely `Polygon` or `MultiPolygon` with holes. What is single-ring is the transport and the drawing:

- **The contract:**
  - `PolygonDetails.path`;
  - `OverlapData.paths`, which holds exteriors only.
- **The API, around the maths:**
  - the parsers (`app/utils/farms.py`);
  - `generate_polygon`;
  - `get_farm_coords_and_radius`;
  - `get_geometry_paths`;
  - `GeometryHelper`: bounds and pixel drawing read `geom.exterior`, and the reprojection rebuilds a `Polygon` from the exterior.
- **The web:**
  - `Map.tsx` (`google.maps.Polygon.setPath`);
  - the four maps and modals that read `details.path`;
  - the exports in `geojson.ts` and `download.ts`;
  - the Excel's geometry-type check (`["Point", "Polygon"]`).

## Goals / Non-Goals

**Goals:**
- A farm's geometry, with all its parts and holes, survives every round trip between the web and the API unchanged.
- One place in the API converts between Shapely and the contract, so no module rebuilds a polygon by hand.
- Existing single-ring farms get the same area, ratio, overlaps and center as today.

**Non-Goals:**
- Splitting a MultiPolygon into several farms.
- One report image per part.
- Lines, MultiPoints and geometry collections.
- Size limits on parts or vertices.
- Translating `explain_validity`.

## Decisions

### 1. Named parts replace `path`

```python
class PolygonPart(BaseModel):
    exterior: list[Coordinates]
    holes: list[list[Coordinates]]

class PolygonDetails(BaseModel):
    center: Coordinates
    parts: list[PolygonPart]
```

`OverlapData.paths` becomes `parts: list[PolygonPart]` too, so a farm and an overlap are drawn by the same web code.

- *Alternative: add `holes` next to `path`.* Rejected. It is the smallest change, but it can't express several parts, and the next change would break the contract again.
- *Alternative: GeoJSON-style nested arrays (`list[list[list[Coordinates]]]`).* Rejected. It relies on the convention "the first ring is the exterior", and the generated TypeScript type (`Coordinates[][][]`) explains nothing. Named fields cost one small conversion to and from GeoJSON and Shapely.
- `holes` has no default. Responses always include it (`json_schema_serialization_defaults_required` is already the pattern), and the web always sends it back.

### 2. A MultiPolygon is one farm

The farm keeps one ID, one producer and one declared production, the way the EUDR treats it as one production place. Area, ratio and overlaps are computed on the whole `MultiPolygon`. Splitting was rejected: it invents IDs and has to split or duplicate the declared production.

### 3. One conversion module in the API

Two functions in `app/utils/polygons.py` become the only crossing between Shapely and the contract:

- `geometry_to_parts(geom) -> list[PolygonPart]`;
- `parts_to_geometry(parts) -> Polygon | MultiPolygon`. It returns a `Polygon` for one part and a `MultiPolygon` otherwise.

`generate_polygon` keeps its role for points (the buffered circle). For polygons it delegates to `parts_to_geometry`. These functions replace the following:

- `get_farm_coords_and_radius` hands parts to `parts_to_geometry`;
- `parse_base_information` and `get_geometry_paths` use `geometry_to_parts`;
- the two coordinate parsers return a Shapely geometry instead of a coordinate list.

The type annotations that say `Polygon` become `Polygon | MultiPolygon` where a farm can be either.

### 4. The API orients rings

`geometry_to_parts` applies `shapely.geometry.polygon.orient(part, sign=1.0)` to each part, which makes the exterior counter-clockwise and the holes clockwise. Google Maps draws a hole only when its inner path winds opposite to the outer one, so the web can pass the rings straight to `paths`. Orienting in the API means one implementation and one test, instead of a winding check in TypeScript.

Orientation doesn't change area, validity or the ratio. It can reverse the vertex order shown in a modal for an input that was clockwise; that is accepted.

### 5. Center: the centroid if it's inside, else a representative point

`center = centroid if geom.contains(centroid) else geom.representative_point()`.

Using `representative_point()` always would move the center of every existing farm, and that center is shown as latitude and longitude in the modals. Keeping the centroid when it's inside means no visible change for today's farms, and a correct point for ring-shaped and multi-part farms.

### 6. The geometry type is deduced from the coordinates

The parser reads the coordinates first:
- **WKT:** by its keyword.
- **GeoJSON:** by the array's depth. Depth 1 is a Point, 3 a Polygon, 4 a MultiPolygon.

It then checks `geometryType` only for the point vs polygonal distinction:
- `"Polygon"` and `"MultiPolygon"` are interchangeable;
- a mismatch between `"Point"` and a polygonal geometry is rejected as today;
- anything else is invalid coordinates.

`InputFarmData.geometryType` becomes `Literal["Point", "Polygon", "MultiPolygon"]`. On the web, `validGeometryTypes` gains `"MultiPolygon"`, and the GeoJSON check accepts a depth-3 or depth-4 array: the commented `validateGeoJSONMultiPolygonCoordinates` in `utils/excel.ts` is revived. The WKT regex accepts `MULTIPOLYGON`.

- *Alternative: require users to write `"MultiPolygon"`.* Rejected by the user: a farm with two parts written as `"Polygon"` is a mistake nobody should be stopped for.

### 7. The web draws one Google Maps polygon per part

`PolygonObject.path` becomes `parts`. `Map.tsx` renders one `google.maps.Polygon` per part, with `setPaths([exterior, ...holes])`, sharing the object's colour and `onClick`. Bounds extend over every exterior. With `showPoints`, the vertex dots cover every ring. The modals' vertex tables label each vertex with its part and ring ("Parte 2 · Hueco 1 · 3") only when the farm has more than one ring, so simple farms look as today. The label goes in the vertex number's cell rather than a new column: the inconsistency modals list vertices as folded rows under the farm's own columns, which have no room for one more.

### 8. Report images: generic geometry operations

In `GeometryHelper`:
- **Bounds:** come from `geom.bounds`, which is valid for every geometry, instead of the exterior's coordinates.
- **Reprojection:** uses `shapely.ops.transform`, which keeps holes and parts, instead of rebuilding a `Polygon` from the exterior.
- **Validation:** `validate_geometry_parameters` accepts `MultiPolygon`.
- **Drawing:** loops over parts and draws each exterior and each hole's outline. PIL's `polygon` can't fill with holes, so the fill is drawn on a mask: fill every exterior, then fill every hole with 0. The mask is then composited, which keeps the requirement that the farm is drawn above the deforestation.

One image per farm contains all its parts (user decision). The zoom is chosen from the bounds as today, so far-apart parts look small but the satellite tile count stays bounded.

### 9. Exports

- **`generateGeoJsonFeature`:**
  - a `Polygon` with `[exterior, ...holes]` for one part;
  - a `MultiPolygon` for several.

  `/generate-image` receives this feature, and decision 8 makes it accept both types.
- **Excel exports:** `fix-excel-export-columns` makes them follow the upload template's columns, with `GeoJSON` as the coordinates format. Here the coordinates cell becomes the full GeoJSON coordinates array: `[exterior, ...holes]` for one part, and a MultiPolygon array for several, with the geometry type `Polygon` or `MultiPolygon`. GeoJSON was chosen over WKT for consistency with the GeoJSON export and the EUDR format. WKT would be a little shorter and states the type in the text, but the type is already in its own column.

## Risks / Trade-offs

- **[Ring winding on Google Maps]** If a hole reaches the map with the same winding as its exterior, Google Maps fills it, and nothing fails. → The API orients all rings (decision 4). A unit test asserts the orientation of every ring returned by `/farms/parse`.
- **[Silent loss of a hole in a code path that still reads the exterior]** An image or a calculation would look right but cover the hole. → Remove every `.exterior` use outside the conversion module. Add a round-trip test: parse, then analyse and validate, with a hole that contains loss.
- **[The contract break reaches a deployed web with an old API, or the reverse]** → Both ship in the same release. The web holds no stored farms, so a reload is enough after a deploy.
- **[Parts far apart make tiny farms in the report]** → Accepted by the user. The image still contains every part.
- **[Larger payloads]** A cadastral MultiPolygon can have thousands of vertices, sent on every call as `{lat, lng}` objects. → No limit in this change. Watch it, and add a limit or a compact encoding later if needed.
- **[A long coordinates cell]** An Excel cell holds at most 32,767 characters, and a GeoJSON array of a farm with many vertices can exceed it. → The export reports the farm as too large to export in Excel, and points to the GeoJSON export, instead of writing a truncated cell.
- **[Regression baselines]** Changing the contract changes the expected payloads. → Regenerate them. Area, ratio, overlap results and center SHALL stay equal for the existing farms, and the tests check this.

## Migration Plan

1. API: the conversion module, the contract, the parsers, validation, analysis and image generation, with tests. Regenerate `openapi.json` and `schema.d.ts`.
2. Web: maps, modals, the Excel validation and the exports, against the new types, in the same PR so the build stays green.
3. Deploy the API and the web together. Rollback: revert the release for both. No data migration, since nothing is stored.

## Open Questions

Resolved during implementation:

- **The Excel templates' instructions** are unchanged. Their geometry type column still says "Point o Polygon". A MultiPolygon written as `Polygon` is accepted, so nobody has to learn the new value; `docs/architecture.md` documents it.
- **The "Polígono" label in tables** is unchanged: the vertex tables already name the parts, and the map shows them.
