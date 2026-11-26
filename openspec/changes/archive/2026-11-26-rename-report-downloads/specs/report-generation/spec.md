## ADDED Requirements

### Requirement: Report downloads are named for Monbo

The complete report SHALL be saved as `monbo-report.pdf`. The separated reports and a large
report's ZIP SHALL be saved as `monbo-reports.zip`. The names SHALL be the same in every UI
language, and SHALL NOT name a single layer category.

#### Scenario: Complete report

- **WHEN** the user downloads "Un PDF con todo"
- **THEN** the file is saved as `monbo-report.pdf`

#### Scenario: Separated reports

- **WHEN** the user downloads "Un PDF por polígono"
- **THEN** the file is saved as `monbo-reports.zip`

#### Scenario: Large report

- **WHEN** the user downloads a large report's ZIP built farm by farm
- **THEN** the file is saved as `monbo-reports.zip`

#### Scenario: English UI

- **WHEN** the UI is in English and the user downloads the complete report
- **THEN** the file is saved as `monbo-report.pdf`
