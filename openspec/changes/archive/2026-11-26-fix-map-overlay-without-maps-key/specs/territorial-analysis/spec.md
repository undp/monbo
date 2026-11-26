## ADDED Requirements

### Requirement: The map view survives a Google Maps key that fails

When the Google Maps key is missing or invalid, the stage 2 map view SHALL show the map's own
error and SHALL NOT take the page down: going back to the table, or changing the layer on the
map, SHALL keep the results page working. Leaving the map SHALL NOT fail because Google Maps
disabled its API after rejecting the key.

#### Scenario: Back to the table with an invalid key

- **WHEN** the web runs with an invalid `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY`, the user opens
  the map view of the results and then chooses "Ver tabla"
- **THEN** the results table shows, and the page does not switch to the global error page

#### Scenario: Changing the layer on a map that failed to load

- **WHEN** the map view shows Google's error because the key was rejected and the user picks
  another layer in the map's layer selector
- **THEN** the page keeps working, with that layer's farm groups in the list
