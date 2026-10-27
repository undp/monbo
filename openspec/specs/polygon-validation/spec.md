# polygon-validation Specification

## Purpose
How `POST /polygons_validation/validate` flags overlapping farms and bad geometries before the analysis, and how polygon coordinates are read from WKT and GeoJSON.
## Requirements
### Requirement: Overlap percentage relative to the smaller farm

`POST /polygons_validation/validate` SHALL report an overlap between two farms whose polygons are both valid and whose intersection has an area. The overlap's `percentage` SHALL be the intersection's area divided by the smaller of the two farms' areas, capped at 1. An overlap SHALL be reported only when 100 × `percentage` is strictly greater than `OVERLAP_THRESHOLD_PERCENTAGE`. Its `criticality` SHALL be `HIGH` when `percentage` is strictly greater than 0.8, and `MEDIUM` otherwise. Every farm in a reported overlap SHALL be `NOT_VALID`.

#### Scenario: A farm contained in another

- **WHEN** a 1 ha farm lies entirely inside a 200 ha farm
- **THEN** an overlap is reported with `percentage` 1 and `criticality` `HIGH`, and both farms are `NOT_VALID`

#### Scenario: A farm almost contained in another

- **WHEN** 99% of a 1 ha farm lies inside a 200 ha farm
- **THEN** an overlap is reported with `percentage` 0.99 and `criticality` `HIGH`

#### Scenario: Identical farms

- **WHEN** two farms have the same polygon
- **THEN** an overlap is reported with `percentage` 1 and `criticality` `HIGH`

#### Scenario: Partial overlap between farms of equal size

- **WHEN** two 1 ha farms share 0.5 ha
- **THEN** an overlap is reported with `percentage` 0.5 and `criticality` `MEDIUM`

#### Scenario: Percentage exactly at the threshold

- **WHEN** `OVERLAP_THRESHOLD_PERCENTAGE` is 1 and two farms overlap by exactly 1% of the smaller one
- **THEN** no overlap is reported, and both farms stay `VALID` unless another inconsistency involves them

#### Scenario: Percentage exactly at the HIGH cut

- **WHEN** two farms overlap by exactly 80% of the smaller one
- **THEN** the overlap's `criticality` is `MEDIUM`

#### Scenario: Three farms overlapping each other

- **WHEN** three farms overlap pairwise above the threshold
- **THEN** one overlap is reported per pair, three in total, and all three farms are `NOT_VALID`

### Requirement: Overlaps use only the intersection's area

An overlap's `area`, `center`, `percentage` and `paths` SHALL come from the polygonal part of the two farms' intersection. Shared edges and vertices SHALL NOT make an overlap. When the intersection has no area, no overlap SHALL be reported for that pair.

#### Scenario: Farms that only share an edge

- **WHEN** two farms share an edge or a vertex and nothing else
- **THEN** no overlap is reported for them

#### Scenario: An overlap that also shares an edge

- **WHEN** two farms overlap in an area and also touch along an edge elsewhere, so their intersection is a `GeometryCollection`
- **THEN** the response is 200, and the overlap's `paths` and `area` describe only the overlapping area

#### Scenario: Tiny farms that only touch

- **WHEN** two polygons small enough that their areas round to 0 m² share an edge
- **THEN** the response is 200 and no overlap is reported for them

### Requirement: A farm's geometry never fails the validation

A problem in a farm's geometry SHALL be reported as an inconsistency of that farm, and SHALL NOT make the request fail. A polygon with no vertices SHALL be reported as `empty_polygon`. A polygon that is invalid SHALL be reported as `invalid_geometry` with a readable `reason`. This includes a polygon with fewer than 3 distinct vertices, a hole that is not inside its part's exterior, and parts of the same farm that overlap each other. Its farm SHALL be `NOT_VALID`. A farm whose `type` doesn't match its `details` SHALL still be rejected with a 400, as it is a malformed request rather than a bad geometry.

#### Scenario: Polygon with a single vertex

- **WHEN** a polygon farm has one vertex
- **THEN** the response is 200, with an `invalid_geometry` inconsistency for that farm, and the other farms are validated normally

#### Scenario: Polygon with two vertices

- **WHEN** a polygon farm has two vertices
- **THEN** it is reported as `invalid_geometry`

#### Scenario: Collinear vertices

- **WHEN** a polygon's vertices all lie on one line
- **THEN** it is reported as `invalid_geometry`

#### Scenario: Self-intersecting polygon

- **WHEN** a polygon crosses itself
- **THEN** it is reported as `invalid_geometry` with a "Self-intersection" reason, and it is left out of the overlap check

#### Scenario: Empty polygon

- **WHEN** a polygon farm has no vertices
- **THEN** it is reported as `empty_polygon`

#### Scenario: Hole outside its exterior

- **WHEN** a farm's hole lies outside its part's exterior
- **THEN** it is reported as `invalid_geometry`, and it is left out of the overlap check

#### Scenario: Parts that overlap each other

- **WHEN** two parts of the same farm overlap
- **THEN** it is reported as `invalid_geometry`, and not as an overlap between farms

#### Scenario: Valid farm with a hole and two parts

- **WHEN** a farm has two separate parts, one of them with a hole inside its exterior
- **THEN** no geometry inconsistency is reported for it

### Requirement: Polygon coordinates from WKT and GeoJSON

When parsing farms, a polygonal farm's coordinates SHALL be accepted as a Polygon or a MultiPolygon, with or without inner rings (holes), in WKT and as a GeoJSON coordinate array. The geometry type SHALL be deduced from the coordinates: the WKT keyword, or the GeoJSON array's nesting depth. The farm's `geometryType` SHALL accept `"Polygon"` and `"MultiPolygon"` for any polygonal geometry, so a user doesn't have to tell them apart. A polygonal geometry given with `geometryType` `"Point"`, or a point given as `"Polygon"` or `"MultiPolygon"`, SHALL be rejected as inconsistent. Other geometries (lines, MultiPoints, collections) SHALL be rejected. The same polygon SHALL get the same parts and area in both formats.

#### Scenario: GeoJSON polygon with a hole

- **WHEN** a farm's coordinates are a GeoJSON polygon with an outer ring and one inner ring
- **THEN** the farm is accepted with one part and one hole, and its area excludes the hole

#### Scenario: WKT polygon with a hole

- **WHEN** a farm's coordinates are the same polygon as a WKT `POLYGON` with an inner ring
- **THEN** the farm gets the same part, hole and area as in GeoJSON

#### Scenario: GeoJSON polygon with a single ring

- **WHEN** a farm's coordinates are a GeoJSON polygon with only an outer ring
- **THEN** it has one part with that exterior and no holes, and the same area as the same polygon in WKT

#### Scenario: WKT MultiPolygon declared as Polygon

- **WHEN** a farm's `geometryType` is `"Polygon"` and its coordinates are a WKT `MULTIPOLYGON` of 2 polygons
- **THEN** the farm is accepted with 2 parts

#### Scenario: GeoJSON MultiPolygon declared as MultiPolygon

- **WHEN** a farm's `geometryType` is `"MultiPolygon"` and its coordinates are a GeoJSON MultiPolygon array of 2 polygons
- **THEN** the farm is accepted with 2 parts

#### Scenario: Simple polygon declared as MultiPolygon

- **WHEN** a farm's `geometryType` is `"MultiPolygon"` and its coordinates are a polygon with one ring
- **THEN** the farm is accepted with one part

#### Scenario: Point declared as polygon

- **WHEN** a farm's `geometryType` is `"Polygon"` and its coordinates are a point
- **THEN** the farm is rejected as inconsistent geometry type and coordinates

#### Scenario: Line

- **WHEN** a farm's coordinates are a WKT `LINESTRING`
- **THEN** the farm is rejected as invalid coordinates

### Requirement: Overlaps respect holes and parts

Overlaps between farms SHALL be computed on each farm's full geometry, with its holes and all its parts. A farm that lies inside another farm's hole SHALL NOT overlap it. An overlap's shape SHALL be returned as `parts`, with the same shape as a farm's (an `exterior` and `holes` per part), replacing `paths`. The web SHALL draw it with its holes.

#### Scenario: Farm inside another's hole

- **WHEN** a farm lies entirely inside the hole of another farm
- **THEN** no overlap is reported for that pair

#### Scenario: Overlap with one part of a MultiPolygon

- **WHEN** a farm overlaps one of the two parts of another farm
- **THEN** an overlap is reported between the two farms, with its `percentage` relative to the smaller farm's total area

#### Scenario: Overlap area with a hole

- **WHEN** farm A has a hole, and farm B lies inside A's exterior and covers the hole entirely
- **THEN** the overlap has one part, whose exterior is B's outline and whose hole is A's hole, and its area excludes the hole

