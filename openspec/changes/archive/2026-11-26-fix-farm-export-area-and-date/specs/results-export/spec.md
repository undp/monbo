## ADDED Requirements

### Requirement: The GeoJSON export writes each farm's area for the EUDR

Each feature of a GeoJSON export SHALL carry `Area` as a JSON number: the farm's area in
hectares (its area in m² divided by 10,000), not rounded, for points and polygons alike. When
the area could not be computed (`null` or `-1`), the feature SHALL NOT have an `Area` property.
`Area` SHALL never be written as a string. Uploading a GeoJSON whose `Area` is `0` or `"0"`, as
exports made before this rule wrote, SHALL still read it as a missing area.

#### Scenario: Point farm

- **WHEN** a point farm of 2.5 ha is exported to GeoJSON
- **THEN** its feature has `"Area": 2.5`

#### Scenario: Polygon farm

- **WHEN** a polygon farm of 67,074.88 m² is exported to GeoJSON
- **THEN** its feature has `"Area": 6.707488`

#### Scenario: Area not computed

- **WHEN** a farm whose area is `-1` is exported to GeoJSON
- **THEN** its feature has no `Area` property

#### Scenario: An old export uploaded again

- **WHEN** a GeoJSON exported with `"Area": "0"` is uploaded
- **THEN** its farms have no area, and a point gets the default area

### Requirement: Exports write the production date as a day

The GeoJSON and Excel exports SHALL write each farm's production date as the calendar day the
report shows for it, as `yyyy-MM-dd`, whatever the browser's time zone. A production date the
app can't read as a date SHALL be written as it was entered. An empty date SHALL stay empty.

#### Scenario: Date from an Excel cell

- **WHEN** a farm whose production date came from an Excel date cell for 15 January 2025 is
  exported, in Bogotá, UTC or Tokyo
- **THEN** both exports write `2025-01-15`

#### Scenario: Date typed in another format

- **WHEN** a farm's production date is the text `15/01/2025`
- **THEN** both exports write `15/01/2025`
