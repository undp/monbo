## ADDED Requirements

### Requirement: Country and layer lists refreshed on demand

The frontend SHALL fetch the country list and the selected country's layer list when the app loads, when the selected country or language changes, and every five minutes. It SHALL also refetch both lists when the tab becomes visible again or the window regains focus, and SHALL refetch the selected country's layer list when the deforestation modal on the polygon validation page opens and when the deforestation upload page opens. The report's layer selection SHALL NOT trigger a refetch, because it lists the layers already analyzed.

On-demand refetches of a list SHALL be skipped while a fetch of that list is in flight, or when one started less than 30 seconds earlier (for the layer list, for the same country). A refetched list SHALL be handled exactly like a polled one.

#### Scenario: Layer enabled while the user is on another tab

- **WHEN** a user has the upload page open for CR, an admin enables a new CR layer, and the user switches back to the tab more than 30 seconds after the last fetch
- **THEN** the layers are fetched again and the new layer is listed without a reload

#### Scenario: Layer enabled before opening the modal

- **WHEN** an admin enables a new CR layer and, more than 30 seconds after the last fetch, a user with CR selected opens the deforestation modal on the polygon validation page
- **THEN** the layers are fetched again and the modal lists the new layer once the response arrives

#### Scenario: New country appears on return to the tab

- **WHEN** an admin enables the first layer for PE while a user has the landing page open on another tab, and the user switches back more than 30 seconds after the last fetch
- **THEN** the countries are fetched again and the landing page shows a Peru card

#### Scenario: Repeated triggers within the gap

- **WHEN** the tab becomes visible, the window gains focus, and the deforestation modal opens, all within 30 seconds of the last layer fetch
- **THEN** no further layer request is sent

#### Scenario: The poll keeps running

- **WHEN** no on-demand trigger happens for five minutes
- **THEN** both lists are fetched by the poll, as before
