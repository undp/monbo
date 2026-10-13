## ADDED Requirements

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

A problem in a farm's geometry SHALL be reported as an inconsistency of that farm, and SHALL NOT make the request fail. A polygon with no vertices SHALL be reported as `empty_polygon`. A polygon that is invalid, including one with fewer than 3 distinct vertices, SHALL be reported as `invalid_geometry` with a readable `reason`. Its farm SHALL be `NOT_VALID`. A farm whose `type` doesn't match its `details` SHALL still be rejected with a 400, as it is a malformed request rather than a bad geometry.

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

### Requirement: Polygon coordinates from WKT and GeoJSON

When parsing farms, a polygon's coordinates SHALL be a single ring, whether given as WKT or as a GeoJSON coordinate array. A polygon with inner rings (holes) SHALL be rejected in both formats, with a message that names holes as the reason: a farm's path can't carry a hole, and dropping it would measure a larger farm than the one declared, with a deforestation ratio that is too low.

#### Scenario: GeoJSON polygon with a hole

- **WHEN** a farm's coordinates are a GeoJSON polygon with an outer ring and one inner ring
- **THEN** the farm is rejected as invalid coordinates, and the message says that polygons with holes are not supported

#### Scenario: WKT polygon with a hole

- **WHEN** a farm's coordinates are a WKT polygon with an outer ring and one inner ring
- **THEN** the farm is rejected with the same message

#### Scenario: GeoJSON polygon with a single ring

- **WHEN** a farm's coordinates are a GeoJSON polygon with only an outer ring
- **THEN** its path is that ring, and it gets the same path and area as the same polygon in WKT
