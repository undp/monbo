## ADDED Requirements

### Requirement: The ratio covers every part and excludes holes

For a farm with holes or several parts, the deforestation ratio SHALL be the loss area inside all its parts, outside its holes, divided by the total area of its parts minus its holes. Loss pixels inside a hole SHALL NOT count. A farm with several parts SHALL get one ratio per layer, not one per part.

#### Scenario: Loss inside a hole

- **WHEN** a farm's only loss pixels lie entirely inside its hole
- **THEN** its ratio for that layer is 0

#### Scenario: Loss in one of two parts

- **WHEN** a farm has two parts of 1 ha each, and 0.5 ha of loss lies inside one of them
- **THEN** its ratio for that layer is 0.25

#### Scenario: Part outside the raster

- **WHEN** one part of a farm lies inside a layer's raster and the other lies outside it
- **THEN** the ratio uses the loss of the part inside, over the area of both parts
