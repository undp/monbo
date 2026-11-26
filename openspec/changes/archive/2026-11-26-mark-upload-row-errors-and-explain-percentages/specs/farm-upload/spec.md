## ADDED Requirements

### Requirement: Rows with problems are marked in the list

Each row of the upload list that has problems of its own (see "Deleting a row drops its
problems") SHALL show an icon in its ID cell: the warning icon of the file notices when the row
only lacks mandatory data, and their error icon otherwise. Hovering or focusing the icon SHALL
show the row's problems, the other-country message first. The icon SHALL be reachable with the
keyboard and SHALL have an accessible name with the farm's name and its problems, in the user's
language. A row without problems of its own, a drawn farm, and a row of an Excel joined to a geo
file SHALL show no icon. A deleted row's problems SHALL never be shown on another row.

#### Scenario: Excel row with malformed coordinates

- **WHEN** the user drops an Excel of 3 farms whose second farm has malformed coordinates
- **THEN** only the second farm's row shows the error icon, and focusing it shows the
  coordinates error

#### Scenario: Feature missing data

- **WHEN** the user drops a GeoJSON whose second feature lacks the producer name
- **THEN** that row shows the warning icon, and its tooltip names the missing attribute

#### Scenario: After deleting a row

- **WHEN** the user deletes the first farm of that Excel
- **THEN** the farm with malformed coordinates still shows its icon and the other farm shows none
