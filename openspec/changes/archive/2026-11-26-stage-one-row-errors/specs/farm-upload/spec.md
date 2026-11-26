## ADDED Requirements

### Requirement: Deleting a row drops its problems

The problems found in one row of a file SHALL belong to that row: an Excel row's validation errors, a geo file feature's problems when its farms are read from its attributes, and a row that declares a country other than the selected one. Deleting the row SHALL drop its problems. A file's problems SHALL be its whole-file problems plus the problems of its rows still in the list. When none is left, the file SHALL stop being marked, SHALL leave the count of sources with problems, and SHALL be uploadable.

A geo file's missing data SHALL count only its features still in the list.

A row's problems SHALL stay dropped when the file is read again, for example after the country changes.

Whole-file problems SHALL stay until the file is removed or fixed: a geo file the API rejected, an Excel without coordinates, and a geo file whose joined Excel was rejected or didn't match it.

#### Scenario: Deleting the row with invalid coordinates

- **WHEN** the user drops an Excel of 3 farms whose row 5 has malformed coordinates, and deletes that row from the list
- **THEN** the Excel's notice and its error leave the list, the summary has no source with problems, and the step's button is enabled for the other 2 farms

#### Scenario: Deleting a row without problems

- **WHEN** the user deletes a valid row of that Excel instead
- **THEN** the Excel is still marked with the error of row 5

#### Scenario: Deleting the features missing data

- **WHEN** the user drops a GeoJSON of 3 features where only feature 2 lacks the producer name, and deletes that feature's row
- **THEN** the GeoJSON is no longer marked as missing data, "Attach Excel" is no longer offered, and its 2 farms can be uploaded

#### Scenario: Deleting the farms of another country

- **WHEN** Colombia is selected and the user drops an Excel whose country column says Peru in one row, and deletes that row
- **THEN** the other-country error leaves the list and the remaining farms can be uploaded

#### Scenario: A deleted row's problem doesn't come back

- **WHEN** the user deletes the row with invalid coordinates and then picks another country in the header
- **THEN** the Excel is read again against the new country and the deleted row's error doesn't come back
