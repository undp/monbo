## ADDED Requirements

### Requirement: The farm sheet says when a point's area was assumed

On a farm's sheet of the report, "Superficie total (ha)" SHALL show the area the analysis used. When the farm is a point whose `polygon.areaAssumed` is true, the sheet SHALL add, below that value, "Área supuesta: 4 ha, no declarada" in Spanish and "Assumed area: 4 ha, not declared" in English, with the number taken from the farm's area. A point with a declared area, and a polygon farm, SHALL NOT show that line.

#### Scenario: Point without a declared area

- **WHEN** the report includes a point farm with `area` 40,000 m² and `areaAssumed` true, in Spanish
- **THEN** its sheet shows "4,00" under "Superficie total (ha)" and the line "Área supuesta: 4 ha, no declarada"

#### Scenario: Point with a declared area

- **WHEN** the report includes a point farm of 2.5 ha with `areaAssumed` false
- **THEN** its sheet shows "2,50" and no assumed-area line

#### Scenario: In English

- **WHEN** the same assumed point is in an English report
- **THEN** the line reads "Assumed area: 4 ha, not declared"
