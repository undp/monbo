## MODIFIED Requirements

### Requirement: The flow is three stages with their own pages

The analysis flow SHALL be presented as three stages, in this order:
1. "Validación" (Validation): `/polygons-validation` and `/polygons-validation/upload-data`;
2. "Análisis territorial" (Territorial analysis): `/territorial-analysis` and
   `/territorial-analysis/upload-data`;
3. "Reporte" (Report): `/report-generation` and `/report-generation/preview`.

The current stage SHALL be read from the route, with or without its locale prefix. A page
outside these routes SHALL have no current stage and SHALL NOT show the flow header.

#### Scenario: Stage of an upload page

- **WHEN** the user is on `/es/territorial-analysis/upload-data`
- **THEN** the current stage is stage 2

#### Scenario: Stage of the report preview

- **WHEN** the user is on `/report-generation/preview`
- **THEN** the current stage is stage 3

#### Scenario: Pages outside the flow

- **WHEN** the user is on the landing page, `/documentation` or an `/admin` page
- **THEN** no flow header is shown

### Requirement: Stage 2 is never blocked and stage 3 needs results

Stages 1 and 2 SHALL always be pressable from another stage. Stage 3 SHALL be pressable only when
analysis results exist; without them it SHALL NOT be a control and SHALL say "Con los resultados de
la etapa 2". The current stage SHALL NOT be a control: it opens no dialog and goes nowhere. That
keeps a dialog from opening over the page the user is on. Pressing another stage SHALL go to:
- stage 1: `/polygons-validation` when validation results exist, `/polygons-validation/upload-data`
  otherwise;
- stage 2: `/territorial-analysis` when analysis results exist. Otherwise
  `/territorial-analysis/upload-data`, where the polygon subset and the layers are chosen;
- stage 3: `/report-generation` when the report's choices are ready: at least one report layer,
  every report layer among the current analysis's layers, and at least one farm chosen for the
  report. Otherwise the report layer modal opens first, and continuing from it goes to
  `/report-generation`.

No dialog stands between stage 1 and stage 2 (D5): the stage 2 page is the step that chooses
what the analysis covers, and it starts no analysis until the user asks, so no analysis runs with a
polygon subset the user didn't choose.

Uploading farms on the stage 2 upload page SHALL drop the validation results of the farms loaded
before: they don't describe the new farms. Stage 1 then shows "Sin realizar · opcional", and no
new farm is hidden as invalid.

The current stage SHALL be marked as the current step for assistive technologies.

#### Scenario: Stage 3 without results

- **WHEN** no analysis results exist
- **THEN** stage 3 can't be pressed or focused as a control

#### Scenario: Direct to stage 2 from stage 1

- **WHEN** the user is on stage 1 with nothing loaded and presses stage 2
- **THEN** the browser goes to `/territorial-analysis/upload-data`

#### Scenario: Stage 2 after a validation

- **WHEN** the polygons were validated, no analysis exists, and the user presses stage 2
- **THEN** the browser goes to `/territorial-analysis/upload-data`, which shows the polygon
  subset and the layers, and no analysis starts

#### Scenario: New farms on stage 2 after a validation

- **WHEN** the polygons of one file were validated and the user uploads another file on the stage 2
  upload page
- **THEN** the earlier validation results are dropped and stage 1 shows "Sin realizar · opcional"

#### Scenario: Stage 2 pressed on stage 2

- **WHEN** the user is on `/territorial-analysis/upload-data` after a validation, before an
  analysis, for example while the analysis runs or after it failed
- **THEN** stage 2 is marked as the current step, is not a control, and nothing happens

#### Scenario: Stage 3 pressed on the report

- **WHEN** the user is on `/report-generation` with no farm chosen for the report
- **THEN** stage 3 is marked as the current step, is not a control, and no dialog opens

#### Scenario: Stage 3 from the stepper

- **WHEN** analysis results exist, no report layer was chosen yet, and the user presses stage 3
- **THEN** the report layer modal opens, and continuing goes to `/report-generation`

#### Scenario: Report layers ticked but not confirmed

- **WHEN** the user ticked a layer in the report layer modal, closed it without continuing, and
  presses stage 3
- **THEN** the report layer modal opens again

#### Scenario: Report layers of an earlier analysis

- **WHEN** the report's layers were chosen, the analysis was run again with other layers, and the
  user presses stage 3
- **THEN** the report layer modal opens again

### Requirement: Stage pages name their stage

Each stage page SHALL show "Etapa N de 3" above its title.

#### Scenario: Stage 2 upload page

- **WHEN** the user opens `/territorial-analysis/upload-data`
- **THEN** "Etapa 2 de 3" is shown above the page title

### Requirement: A next-stage card closes stages 1 and 2

The validation results page SHALL end with a "Siguiente etapa" card for "Análisis territorial",
and the analysis results page with one for "Reporte". Each card SHALL show the next stage's
number, its name, a one-line description and a "Continuar" button. "Continuar" SHALL go to the
stage 2 page from stage 1, where the polygon subset and the layers are chosen, and SHALL open the
report layer modal from stage 2. These cards SHALL replace the fixed footer's
"Analizar" and "Crear reporte" buttons. Stage 3 SHALL have no next-stage card.

#### Scenario: From validation to analysis

- **WHEN** the user is on the validation results and presses "Continuar" on the card
- **THEN** the browser goes to `/territorial-analysis/upload-data`, with the polygon subset and
  the layer choice

#### Scenario: From analysis to report

- **WHEN** the user is on the analysis results and presses "Continuar" on the card
- **THEN** the report layer modal opens
