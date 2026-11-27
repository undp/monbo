## ADDED Requirements

### Requirement: A point without an area is analysed as 4 ha

When `POST /farms/parse` receives a point farm whose `area` is missing, `null`, blank, or a number equal to zero (`0`, `"0"`, `"0,0"`), it SHALL give the point an area of 4 ha, the area TRACES assigns to a point without one, and SHALL build its circle from it: a radius of √(40,000 m² / π), rounded to 2 decimals (112.84 m). The point's `polygon` SHALL then carry `areaAssumed: true`. A point that declares a positive area SHALL keep it and SHALL carry `areaAssumed: false`. `areaAssumed` SHALL always be present in a point's `polygon`, and SHALL NOT exist in a polygon farm's. A polygon farm's area SHALL still be computed from its geometry, whatever its `area` field says.

#### Scenario: Point without an area

- **WHEN** a point farm is parsed with no `area`
- **THEN** its `polygon.area` is 40,000 m², its radius is 112.84 m and its `polygon.areaAssumed` is true

#### Scenario: Point with a zero area

- **WHEN** a point farm is parsed with `area` `0` or `"0"`
- **THEN** it gets the same 4 ha circle and `areaAssumed` true

#### Scenario: Point with a declared area

- **WHEN** a point farm is parsed with `area` `2.5`
- **THEN** its `polygon.area` is 25,000 m² and its `areaAssumed` is false

#### Scenario: The regression point without an area

- **WHEN** the regression suite runs F05 of `regression_farms.xlsx`, a point with no area
- **THEN** it is analysed as a 4 ha circle, and its expected results are the ones regenerated for that circle
