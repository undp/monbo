## ADDED Requirements

### Requirement: A point's image draws the circle that was analysed

`POST /layer_analysis/generate-image` SHALL accept `pointRadiusMeters`, a number of meters greater than 0 and at most 10,000. When the feature is a point, it SHALL draw the point as the circle of that radius, and SHALL answer 400 when `pointRadiusMeters` is missing. A value out of range SHALL be rejected with 422. For a polygon, `pointRadiusMeters` SHALL be ignored. The web SHALL send, for every image of a point farm, the farm's `polygon.details.radius`: the same radius the analysis measured.

#### Scenario: A point without a declared area

- **WHEN** the report asks for the image of a point farm analysed as 4 ha
- **THEN** the request carries `pointRadiusMeters` 112.84, and the image draws a circle of 112.84 m around the point

#### Scenario: A point without a radius

- **WHEN** `generate-image` receives a point feature without `pointRadiusMeters`
- **THEN** it answers 400 and generates no image

#### Scenario: A polygon

- **WHEN** `generate-image` receives a polygon feature, with or without `pointRadiusMeters`
- **THEN** it draws the polygon as today
