## MODIFIED Requirements

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

## ADDED Requirements

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
