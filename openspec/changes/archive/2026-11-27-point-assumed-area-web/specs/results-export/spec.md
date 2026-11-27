## MODIFIED Requirements

### Requirement: Excel exports can be uploaded again

An Excel export SHALL be readable as a farms file in the same language: uploading it SHALL give back the same farms, with the same ID, producer, production date, quantity, unit, region, crop, association, documents and geometry. A point's declared area SHALL come back as it was, not rounded: an upload takes a missing or zero area as undeclared and gives the point the default 4 ha. A point whose area was assumed (`areaAssumed` true) SHALL be written with an empty area, so it comes back as undeclared, with the 4 ha default and `areaAssumed` true again. Production quantity and area SHALL be written as numeric cells, so they don't depend on the language's decimal separator.

#### Scenario: Spanish export uploaded again

- **WHEN** a polygon farm with a production of 1200.5 kg and a point farm of 2.5 ha are exported in Spanish, and the file is uploaded in Spanish
- **THEN** both farms parse with no errors, with 1200.5 as the quantity, the same polygon, and 2.5 ha for the point

#### Scenario: English export uploaded again

- **WHEN** the same farms are exported and uploaded in English
- **THEN** they parse with no errors and the same values

#### Scenario: A point with an assumed area

- **WHEN** a point farm whose area was assumed is exported
- **THEN** its area cell is empty

### Requirement: The GeoJSON export writes each farm's area for the EUDR

Each feature of a GeoJSON export SHALL carry `Area` as a JSON number: the farm's area in
hectares (its area in m² divided by 10,000), not rounded, for points and polygons alike. When
the area could not be computed (`null` or `-1`), the feature SHALL NOT have an `Area` property.
When the farm is a point whose area was assumed (`areaAssumed` true), the feature SHALL NOT have
an `Area` property either: TRACES then assigns the point its own default, the same 4 ha Monbo
analysed. `Area` SHALL never be written as a string. Uploading a GeoJSON whose `Area` is `0` or
`"0"`, as exports made before this rule wrote, SHALL still read it as a missing area.

#### Scenario: Point farm

- **WHEN** a point farm of 2.5 ha is exported to GeoJSON
- **THEN** its feature has `"Area": 2.5`

#### Scenario: Polygon farm

- **WHEN** a polygon farm of 67,074.88 m² is exported to GeoJSON
- **THEN** its feature has `"Area": 6.707488`

#### Scenario: Area not computed

- **WHEN** a farm whose area is `-1` is exported to GeoJSON
- **THEN** its feature has no `Area` property

#### Scenario: Point with an assumed area

- **WHEN** a point farm whose area was assumed is exported to GeoJSON
- **THEN** its feature has no `Area` property

#### Scenario: An old export uploaded again

- **WHEN** a GeoJSON exported with `"Area": "0"` is uploaded
- **THEN** its farms have no area, and a point gets the default area
