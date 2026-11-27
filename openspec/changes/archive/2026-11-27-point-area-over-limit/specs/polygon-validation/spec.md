## ADDED Requirements

### Requirement: A point over 4 ha must be declared as a polygon

`POST /polygons_validation/validate` SHALL report a point farm whose area is over 4 ha as an inconsistency of type `point_area_over_limit` for that farm, with `data.areaHectares` (the point's area, π·radius², in hectares, rounded to 2 decimals) and `data.maxAreaHectares` (4). The area SHALL be judged from the point's radius against the radius of a 4 ha circle as the API rounds it (112.84 m), so a point declared as exactly 4 ha, or given the 4 ha default, is not reported. The farm SHALL be `NOT_VALID`. The point SHALL still take part in the overlap check. A polygon farm SHALL never get this inconsistency, whatever its area.

#### Scenario: A 5 ha point

- **WHEN** a point farm of 5 ha (radius 126.16 m) is validated
- **THEN** the response has a `point_area_over_limit` inconsistency for it with `areaHectares` 5 and `maxAreaHectares` 4, and the farm is `NOT_VALID`

#### Scenario: A 4 ha point

- **WHEN** a point farm declared as 4 ha (radius 112.84 m), or without an area, is validated
- **THEN** no `point_area_over_limit` inconsistency is reported for it

#### Scenario: A large polygon

- **WHEN** a polygon farm of 54 ha is validated
- **THEN** no `point_area_over_limit` inconsistency is reported for it
