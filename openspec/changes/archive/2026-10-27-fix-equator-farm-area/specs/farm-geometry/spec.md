## ADDED Requirements

### Requirement: A farm's area is measured on the ellipsoid

The API SHALL measure the area of a polygon farm, and of an overlap between farms, as its geodesic area on the WGS84 ellipsoid, in square metres rounded to 2 decimals. Holes SHALL be subtracted and the parts of a farm added, whatever the orientation of the input rings. The area SHALL NOT depend on a map projection, and SHALL NOT fail because of where the farm lies, including across the equator. An invalid polygon SHALL keep an area of −1 and an empty one an area of 0.

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
