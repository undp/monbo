

## RENAMED Requirements

- FROM: `### Requirement: The browser reports report requests and downloads`
- TO: `### Requirement: The browser reports report requests and downloads (superseded)`

## REMOVED Requirements

### Requirement: The browser reports report requests and downloads (superseded)

**Reason**: The previous version of the requirement, replaced whole by the one of the same name under ADDED: it drops or renames scenarios ("Generate report"), which a MODIFIED block can't express.

**Migration**: None; the requirement keeps its name.

## ADDED Requirements

### Requirement: The browser reports report requests and downloads

The web SHALL send events to `POST /events`:
- **`report_requested`:** when the user presses "Generar vista previa" or "Actualizar vista previa" on the report page, with `farms` set to the number of ticked farms. The button is off with no farm ticked, so no event is sent for an empty choice.
- **`report_downloaded`, outcome `ok`:** after a report is saved. `format` SHALL be `pdf` for the complete report (one PDF) and `zip` for the separated or large report (one PDF per farm), and `farms` the number of farms in it. Saving the GeoJSON SHALL NOT send it.
- **`report_downloaded`, outcome `error`:** when a download fails with the error message shown to the user, with the same `format` and `farms`.

Every event SHALL carry the session ID and the selected country. The web SHALL NOT send an event when the user cancels a large report, leaves the page during a render, or is sent back to re-run the analysis because a layer changed. The web SHALL send events in the background with `keepalive`, SHALL ignore their failures, and SHALL NOT show them to the user.

#### Scenario: Generate the preview

- **WHEN** a user ticks 5 farms and presses "Generar vista previa"
- **THEN** a `report_requested` event with `farms` 5 is sent

#### Scenario: Opening the report page

- **WHEN** the user opens the report page
- **THEN** no `report_requested` event is sent

#### Scenario: One PDF

- **WHEN** the user downloads the complete report of 5 farms
- **THEN** a `report_downloaded` event with outcome `ok`, `format` `pdf` and `farms` 5 is sent

#### Scenario: Several PDFs

- **WHEN** the user downloads the separated reports of 5 farms as a ZIP
- **THEN** a `report_downloaded` event with outcome `ok`, `format` `zip` and `farms` 5 is sent

#### Scenario: GeoJSON

- **WHEN** the user saves the report's GeoJSON
- **THEN** no `report_downloaded` event is sent

#### Scenario: Cancelled large report

- **WHEN** the user cancels a large report's ZIP while it is being built
- **THEN** no `report_downloaded` event is sent

#### Scenario: Events endpoint down

- **WHEN** `POST /events` fails
- **THEN** the download completes and the user sees no error
