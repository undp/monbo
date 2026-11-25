# farm-geometry Specification

## Purpose
How a farm's geometry (a point, or a polygon of one or several parts with their holes) travels between the API and the web, and how the web draws and exports it.
## Requirements
### Requirement: A polygon farm is a list of parts with holes

A polygon farm's `details` SHALL carry its geometry as `parts`, a non-empty list. Each part SHALL have an `exterior` ring and a `holes` list of rings, which is empty when the part has no holes. A farm given as a Polygon SHALL have one part. A farm given as a MultiPolygon SHALL have one part per polygon, in the input's order, and SHALL remain a single farm with a single ID. `details` SHALL NOT carry a `path` field. Every ring SHALL be closed: its last vertex equals its first.

#### Scenario: Simple polygon

- **WHEN** a farm is uploaded as a polygon with one ring
- **THEN** its `details.parts` has one part, whose `exterior` is that ring and whose `holes` is empty

#### Scenario: Polygon with a hole

- **WHEN** a farm is uploaded as a polygon with an outer ring and one inner ring
- **THEN** its `details.parts` has one part with that exterior and one hole

#### Scenario: MultiPolygon

- **WHEN** a farm is uploaded as a MultiPolygon of 3 polygons, one of them with a hole
- **THEN** the farm keeps its ID, and its `details.parts` has 3 parts in the input's order, the one with a hole carrying it in `holes`

### Requirement: The API orients every ring

The API SHALL return every `exterior` ring counter-clockwise and every hole clockwise, whatever the orientation of the input. The web SHALL be able to draw the rings as given.

#### Scenario: Clockwise input

- **WHEN** a farm is uploaded with a clockwise exterior and a counter-clockwise hole
- **THEN** the API returns the exterior counter-clockwise and the hole clockwise, with the same vertices and the same area

### Requirement: A polygon farm's center lies inside it

A polygon farm's `center` SHALL be a point inside the farm's area: not in a hole, and not between its parts. When the farm's centroid lies inside it, the `center` SHALL be the centroid, as today.

#### Scenario: Convex farm

- **WHEN** a farm is a simple convex polygon
- **THEN** its `center` is its centroid, the same point as before this change

#### Scenario: Ring-shaped farm

- **WHEN** a farm is a square with a hole that covers its centroid
- **THEN** its `center` lies inside the square and outside the hole

#### Scenario: Two separate parts

- **WHEN** a farm has two parts 5 km apart
- **THEN** its `center` lies inside one of the parts

### Requirement: A farm's geometry survives the round trip

When the web sends a farm back to the API, to `POST /polygons_validation/validate`, `POST /deforestation_analysis/analize` or `/generate-image`, the API SHALL rebuild the same geometry: every part and every hole. Its area and its analysis SHALL NOT change because of the round trip.

#### Scenario: Farm with a hole sent to the analysis

- **WHEN** a farm with a hole, as returned by `/farms/parse`, is sent to `/analize`
- **THEN** the polygon analysed has that hole, and loss pixels inside the hole don't count

### Requirement: Maps draw every part and hole

Every map in the web that draws a polygon farm SHALL draw all of its parts, each with its holes as empty areas. Clicking any part SHALL act as clicking the farm. The map's initial view SHALL fit all the parts.

#### Scenario: Farm with a hole on the map

- **WHEN** a farm with a hole is shown on a map
- **THEN** the hole is drawn empty, with the farm's outline around it

#### Scenario: Two separate parts on the map

- **WHEN** a farm with two parts far apart is shown on a map
- **THEN** both parts are drawn, the initial view contains both, and clicking either selects the farm

### Requirement: Vertex tables name the part and ring

Where the web lists a polygon farm's vertices, each vertex SHALL say which part and which ring (exterior or hole number) it belongs to, whenever the farm has more than one ring.

#### Scenario: Farm with one ring

- **WHEN** the detail of a farm with a single exterior ring is opened
- **THEN** its vertices are listed as today, without part or ring labels

#### Scenario: Farm with a hole

- **WHEN** the detail of a farm with a hole is opened
- **THEN** each vertex is labelled as belonging to the exterior or to hole 1

### Requirement: Exports keep the farm's geometry

The GeoJSON export SHALL write a farm with one part as a `Polygon`, and a farm with several parts as a `MultiPolygon`, with holes as inner rings in both cases. The Excel exports SHALL write a polygon farm's coordinates as a GeoJSON coordinates array (a Polygon's rings, or a MultiPolygon's polygons), with `GeoJSON` as the coordinates format and `Polygon` or `MultiPolygon` as the geometry type, so an exported file can be uploaded again. Point farms SHALL be exported as today.

#### Scenario: GeoJSON export of a simple polygon

- **WHEN** a farm with one part and no holes is exported to GeoJSON
- **THEN** its geometry is a `Polygon` with one ring, as today

#### Scenario: GeoJSON export of a MultiPolygon

- **WHEN** a farm with 2 parts is exported to GeoJSON
- **THEN** its geometry is a `MultiPolygon` with 2 polygons

#### Scenario: Excel export uploaded again

- **WHEN** an Excel export with a farm that has a hole is uploaded as a farms file
- **THEN** the farm comes back with the same parts, hole and area

### Requirement: A farm's area is measured on the ellipsoid

The API SHALL measure the area of a polygon farm, and of an overlap between farms, as its geodesic area on the WGS84 ellipsoid, in square metres rounded to 2 decimals. Holes SHALL be subtracted and the parts of a farm added, whatever the orientation of the input rings. The area SHALL NOT depend on a map projection, and SHALL NOT fail because of where the farm lies, including across the equator. An invalid polygon, or one whose geodesic area is not a finite number, SHALL keep an area of −1, and an empty one an area of 0.

#### Scenario: Farm symmetric about the equator

- **WHEN** a 300 ha square farm runs from latitude −0.008° to +0.008°
- **THEN** it is uploaded with its area, validated without errors, and gets a deforestation ratio on each layer

#### Scenario: Overlap symmetric about the equator

- **WHEN** two farms overlap in an area whose latitudes are exactly opposite
- **THEN** `/polygons_validation/validate` answers 200 and reports the overlap

#### Scenario: Same area as before for an ordinary farm

- **WHEN** the area of a farm of up to 1,000 ha, between latitudes 60°S and 60°N, is measured
- **THEN** it differs from the area the previous method gave by less than 0.001%

#### Scenario: Hole and parts

- **WHEN** a farm has a hole of 1 ha in a 10 ha exterior, and a second part of 5 ha
- **THEN** its area is 14 ha

#### Scenario: Clockwise rings

- **WHEN** the same farm is given with a clockwise exterior and a counter-clockwise hole
- **THEN** its area is the same, and positive

#### Scenario: Invalid and empty polygons

- **WHEN** the polygon crosses itself, or is empty
- **THEN** its area is −1, or 0

#### Scenario: Polygon beyond the poles

- **WHEN** a polygon's latitudes are beyond 90°, which Shapely accepts but has no geodesic area
- **THEN** its area is −1, never a null in a response

