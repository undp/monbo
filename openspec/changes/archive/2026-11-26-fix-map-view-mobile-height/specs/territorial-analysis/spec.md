## ADDED Requirements

### Requirement: The results map is visible on a narrow screen

Below the `md` breakpoint (900 px), the results page's map view SHALL show the map 360 px tall
under the farm list, with the layer's legend over it. From `md` up, the map SHALL fill the height
beside the list, as before.

#### Scenario: A phone

- **WHEN** the user opens the map view on a 390 px wide screen
- **THEN** the map is 360 px tall under the farm list, not blank

#### Scenario: A desktop

- **WHEN** the user opens the map view on a 1280 px wide screen
- **THEN** the map fills the height beside the 320 px farm list, as before
