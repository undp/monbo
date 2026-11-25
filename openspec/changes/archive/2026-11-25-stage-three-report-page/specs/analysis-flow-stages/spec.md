## MODIFIED Requirements

### Requirement: A next-stage card closes stages 1 and 2

The validation results page SHALL end with a "Siguiente etapa" card for "Análisis territorial",
and the analysis results page with one for "Reporte". Each card SHALL show the next stage's
number, its name, a one-line description and a "Continuar" button. "Continuar" SHALL go to the
stage 2 layers page from stage 1, where the polygon subset and the layers are chosen, and to
`/report-generation` from stage 2, where the report's polygons and layers are chosen. Neither
opens a dialog. These cards SHALL replace the fixed footer's "Analizar" and "Crear reporte"
buttons. Stage 3 SHALL have no next-stage card.

#### Scenario: From validation to analysis

- **WHEN** the user is on the validation results and presses "Continuar" on the card
- **THEN** the browser goes to `/territorial-analysis/layers`, with the polygon subset and the
  layer choice

#### Scenario: From analysis to report

- **WHEN** the user is on the analysis results and presses "Continuar" on the card
- **THEN** the browser goes to `/report-generation`, and no dialog opens

## RENAMED Requirements

- FROM: `### Requirement: The flow is three stages with their own pages`
- TO: `### Requirement: The flow is three stages with their own pages (superseded)`
- FROM: `### Requirement: Stage 2 is never blocked and stage 3 needs results`
- TO: `### Requirement: Stage 2 is never blocked and stage 3 needs results (superseded)`

## REMOVED Requirements

### Requirement: The flow is three stages with their own pages (superseded)

**Reason**: The previous version of the requirement, replaced whole by the one of the same name under ADDED: it drops or renames scenarios ("Stage of the report preview"), which a MODIFIED block can't express.

**Migration**: None; the requirement keeps its name.

### Requirement: Stage 2 is never blocked and stage 3 needs results (superseded)

**Reason**: The previous version of the requirement, replaced whole by the one of the same name under ADDED: it drops or renames scenarios ("Report layers ticked but not confirmed", "Report layers of an earlier analysis"), which a MODIFIED block can't express.

**Migration**: None; the requirement keeps its name.

## ADDED Requirements

### Requirement: The flow is three stages with their own pages

The analysis flow SHALL be presented as three stages, in this order:
1. "Validación" (Validation): `/polygons-validation` and `/polygons-validation/upload-data`;
2. "Análisis territorial" (Territorial analysis): `/territorial-analysis/upload-data` (the
   polygons), `/territorial-analysis/layers` (the layers and the polygon subset) and
   `/territorial-analysis` (the results);
3. "Reporte" (Report): `/report-generation`, where the report's polygons and layers are chosen,
   previewed and downloaded. `/report-generation/preview` SHALL redirect to
   `/report-generation`.

The current stage SHALL be read from the route, with or without its locale prefix. A page
outside these routes SHALL have no current stage and SHALL NOT show the flow header.

#### Scenario: Stage of an upload page

- **WHEN** the user is on `/es/territorial-analysis/upload-data`
- **THEN** the current stage is stage 2

#### Scenario: Stage of the layers page

- **WHEN** the user is on `/territorial-analysis/layers`
- **THEN** the current stage is stage 2

#### Scenario: Stage of the report page

- **WHEN** the user is on `/report-generation`
- **THEN** the current stage is stage 3

#### Scenario: The old preview route

- **WHEN** the user opens `/report-generation/preview`
- **THEN** the browser is sent to `/report-generation`

#### Scenario: Pages outside the flow

- **WHEN** the user is on the landing page, `/documentation` or an `/admin` page
- **THEN** no flow header is shown

### Requirement: Stage 2 is never blocked and stage 3 needs results

Stages 1 and 2 SHALL always be pressable from another stage. Stage 3 SHALL be pressable only when
analysis results exist; without them it SHALL NOT be a control and SHALL say "Con los resultados de
la etapa 2". The current stage SHALL NOT be a control: it opens no dialog and goes nowhere. Pressing
another stage SHALL go to:
- stage 1: `/polygons-validation` when validation results exist, `/polygons-validation/upload-data`
  otherwise;
- stage 2: `/territorial-analysis` when analysis results exist; otherwise
  `/territorial-analysis/layers` when farms are loaded, where the polygon subset and the layers are
  chosen; otherwise `/territorial-analysis/upload-data`, where the polygons are uploaded;
- stage 3: `/report-generation`, where the report's polygons and layers are chosen. No dialog
  opens on the way.

No dialog stands between stage 1 and stage 2 (D5): the layers page is the step that chooses what
the analysis covers, and it starts no analysis until the user asks, so no analysis runs with a
polygon subset the user didn't choose. For the same reason no dialog stands between stage 2 and
stage 3: the report page is the step that chooses what the report covers, and it renders nothing
until the user asks.

Confirming a changed upload list on stage 2 ("Continuar") SHALL drop the validation results of
the farms loaded before: they don't describe the new farms. Stage 1 then shows "Sin realizar ·
opcional", and no new farm is hidden as invalid. Confirming the list unchanged SHALL keep them.

The current stage SHALL be marked as the current step for assistive technologies.

#### Scenario: Stage 3 without results

- **WHEN** no analysis results exist
- **THEN** stage 3 can't be pressed or focused as a control

#### Scenario: Direct to stage 2 from stage 1

- **WHEN** the user is on stage 1 with nothing loaded and presses stage 2
- **THEN** the browser goes to `/territorial-analysis/upload-data`

#### Scenario: Stage 2 after a validation

- **WHEN** the polygons were validated, no analysis exists, and the user presses stage 2
- **THEN** the browser goes to `/territorial-analysis/layers`, which shows the polygon subset and
  the layers, and no analysis starts

#### Scenario: New farms on stage 2 after a validation

- **WHEN** the polygons of one file were validated, and on the stage 2 upload page the user adds
  another file to the list and presses "Continuar"
- **THEN** the earlier validation results are dropped and stage 1 shows "Sin realizar · opcional"

#### Scenario: The list confirmed unchanged

- **WHEN** the polygons were validated, the user opens the stage 2 upload page and presses
  "Continuar" without changing the list
- **THEN** the validation results are kept and stage 1 still shows "Completada"

#### Scenario: Stage 2 pressed on stage 2

- **WHEN** the user is on `/territorial-analysis/layers` after a validation, before an analysis,
  for example while the analysis runs or after it failed
- **THEN** stage 2 is marked as the current step, is not a control, and nothing happens

#### Scenario: Stage 3 pressed on the report

- **WHEN** the user is on `/report-generation` with no polygon ticked
- **THEN** stage 3 is marked as the current step, is not a control, and no dialog opens

#### Scenario: Stage 3 from the stepper

- **WHEN** analysis results exist, the report page was never opened, and the user presses stage 3
- **THEN** the browser goes to `/report-generation` and no dialog opens

#### Scenario: Report choices of an earlier analysis

- **WHEN** the report's layers were chosen, the analysis was run again with other layers, and the
  user presses stage 3
- **THEN** the browser goes to `/report-generation`, which starts again with every polygon and
  every layer of the new analysis
