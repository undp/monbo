## MODIFIED Requirements

### Requirement: Polygon coordinates from WKT and GeoJSON

When parsing farms, a polygonal farm's coordinates SHALL be accepted as a Polygon or a MultiPolygon, with or without inner rings (holes), in WKT and as a GeoJSON coordinate array. The geometry type SHALL be deduced from the coordinates: the WKT keyword, or the GeoJSON array's nesting depth. The farm's `geometryType` SHALL accept `"Polygon"` and `"MultiPolygon"` for any polygonal geometry, so a user doesn't have to tell them apart. A polygonal geometry given with `geometryType` `"Point"`, or a point given as `"Polygon"` or `"MultiPolygon"`, SHALL be rejected as inconsistent. Other geometries (lines, MultiPoints, collections) SHALL be rejected. Every coordinate SHALL be a WGS84 position in degrees, longitude from −180 to 180 and latitude from −90 to 90; a farm with a coordinate outside those ranges, point or polygon, in either format, SHALL be rejected as invalid coordinates, since it has no place on the ellipsoid. The same polygon SHALL get the same parts and area in both formats.

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

#### Scenario: Coordinates beyond the poles

- **WHEN** a farm's coordinates are a polygon with latitudes of 95° and 96°, in WKT or GeoJSON, or a point with a longitude of 200°
- **THEN** `/farms/parse` answers 400 naming the latitude or longitude range, instead of a farm with a null area
