## ADDED Requirements

### Requirement: A point's circle previews 4 ha until it has an area

While the user places a point in the drawing modal and its area field is empty or not a positive number, the map SHALL draw the point's circle for 4 ha (a radius of 112.84 m), the area the API assumes for a point without one. Once the field has a positive area, the circle SHALL be drawn for that area. The area SHALL still be mandatory to add a point farm.

#### Scenario: A point without an area yet

- **WHEN** the user places a point and hasn't typed its area
- **THEN** the map draws a circle of 112.84 m around it

#### Scenario: A point with its area

- **WHEN** the user then types 2,5 in the area field
- **THEN** the circle's radius becomes 89.21 m
