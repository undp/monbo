## ADDED Requirements

### Requirement: The farm sheet shows the production date that was uploaded

The farm sheet SHALL show the farm's production date as the calendar day the user uploaded, in the browser's time zone, whatever that zone is. A date-only value (`YYYY-MM-DD`, as an Excel text cell or a geo file attribute holds it) SHALL be read as that day, never as UTC midnight. A value with a time (the ISO string the Excel loader writes for a date cell and the manual farm form writes for its date field) SHALL be read as that instant in the browser's time zone. The date SHALL be printed `dd-MM-yyyy` in Spanish and `yyyy-MM-dd` in English. A production date that cannot be read as a date SHALL be printed as written, and SHALL NOT stop the report from being built.

#### Scenario: A text date west of UTC

- **WHEN** a farm's production date is the text `2025-01-15` and the browser's time zone is `America/Bogota`
- **THEN** its sheet reads `15-01-2025` in Spanish and `2025-01-15` in English

#### Scenario: The three inputs agree

- **WHEN** the same day, January 15 2025, arrives as an Excel text cell, as an Excel date cell and from the manual farm form, in `America/Bogota`, `UTC` or `Asia/Tokyo`
- **THEN** the three farms show `15-01-2025` in Spanish

#### Scenario: A date that cannot be read

- **WHEN** a farm's production date is the text `15/01/2025`
- **THEN** its sheet shows `15/01/2025` and the report is built
