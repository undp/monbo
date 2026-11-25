# analysis-flow-stages Specification

## Purpose
TBD - created by archiving change progressive-flow-stages. Update Purpose after archive.
## Requirements
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

### Requirement: Flow header on every stage page

Every stage page SHALL show, below the application header, a flow header with a forest
background that holds:
- "Análisis en {country} · Cambiar país", where `{country}` is the selected country's name in
  the current language and "Cambiar país" goes to the landing page;
- the note "Gratis · tus polígonos no se guardan en nuestros servidores";
- the stage stepper.

The background image SHALL be served by the web app itself, without requests to third parties.
The header's and the stepper's titles SHALL use the application's heading font when it is
defined (`--font-heading`) and the body font otherwise.

#### Scenario: Header on the validation page

- **WHEN** the selected country is CO, the language is Spanish and the user opens
  `/polygons-validation/upload-data`
- **THEN** the flow header reads "Análisis en Colombia · Cambiar país" and shows the free-use note
  and the stepper

#### Scenario: Changing the country

- **WHEN** the user presses "Cambiar país"
- **THEN** the browser goes to the landing page, where the country is chosen

### Requirement: Each stage's state is derived from the flow in the browser

Each stage in the stepper SHALL show exactly one state, computed only from the current stage,
whether polygon validation results exist and whether analysis results exist in the browser's
flow state. No new state SHALL be stored, on the server or in the browser, to compute it.

- Stage 1: "Estás aquí" on stage 1; otherwise "Completada" when validation results exist;
  otherwise "Sin realizar · opcional".
- Stage 2: "Estás aquí" on stage 2; otherwise "Completada" when analysis results exist;
  otherwise "Puedes ir directo" before stage 2, and "Sin realizar · opcional" after it.
- Stage 3: "Estás aquí" on stage 3; otherwise "Disponible" when analysis results exist;
  otherwise "Con los resultados de la etapa 2".

Results that were invalidated because a layer changed SHALL NOT count as analysis results.

#### Scenario: Normal entry

- **WHEN** the user opens stage 1 with nothing loaded
- **THEN** stage 1 is "Estás aquí", stage 2 is "Puedes ir directo" and stage 3 is "Con los
  resultados de la etapa 2"

#### Scenario: Validation finished

- **WHEN** the polygons were validated and the user is on stage 2 without analysis results
- **THEN** stage 1 is "Completada", stage 2 is "Estás aquí" and stage 3 is "Con los resultados de
  la etapa 2"

#### Scenario: Direct entry to stage 2

- **WHEN** the user opens stage 2 without having validated any polygon
- **THEN** stage 1 is "Sin realizar · opcional" and stage 2 is "Estás aquí"

#### Scenario: Analysis finished

- **WHEN** analysis results exist and the user is on stage 2
- **THEN** stage 3 is "Disponible"

#### Scenario: Back to stage 1 after the analysis

- **WHEN** validation and analysis results exist and the user is on stage 1
- **THEN** stage 1 is "Estás aquí", stage 2 is "Completada" and stage 3 is "Disponible"

#### Scenario: Outdated analysis

- **WHEN** a layer changed and the analysis results were invalidated
- **THEN** stage 2 is not "Completada" and stage 3 is "Con los resultados de la etapa 2"

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

### Requirement: The stepper shows progress with a staggered entrance

The stepper SHALL show the three stages joined by two progress bars. A completed stage SHALL show
a check instead of its number, and a skipped stage a dashed outline. The stages SHALL appear one
after another, and the bars SHALL fill after them. Users who ask the system for reduced motion
SHALL get the final state without animation. On a narrow screen the stages SHALL stack, the
bars SHALL be hidden, and the flow header SHALL fit the viewport's width.

#### Scenario: Reduced motion

- **WHEN** the browser reports `prefers-reduced-motion: reduce`
- **THEN** the stepper is shown in its final state with no entrance animation

#### Scenario: Phone width

- **WHEN** the viewport is 390 px wide
- **THEN** the three stages are stacked, and the flow header and the stepper add no horizontal
  scroll

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

### Requirement: The application header has no stage buttons

The application header SHALL NOT show buttons for the validation, analysis and report modules:
the stepper is the only way to move between stages. Nothing in the header SHALL block a stage.

#### Scenario: Header on a stage page

- **WHEN** the user is on `/polygons-validation` with validation results
- **THEN** the application header shows no "Validación", "Análisis de deforestación" or "Reporte"
  button, and the stepper shows the three stages

### Requirement: Stage pages name their stage

Each stage page SHALL show "Etapa N de 3" above its title.

#### Scenario: Stage 2 upload page

- **WHEN** the user opens `/territorial-analysis/upload-data`
- **THEN** "Etapa 2 de 3" is shown above the page title

#### Scenario: Stage 2 layers page

- **WHEN** the user opens `/territorial-analysis/layers`
- **THEN** "Etapa 2 de 3" is shown above the page title

### Requirement: Flow texts are translated

Every text of the flow header, the stepper and the next-stage cards SHALL come from the `flow`
namespace, with every key in `es` and `en`.

#### Scenario: English

- **WHEN** the language is English
- **THEN** the stepper reads "Validation", "Territorial analysis" and "Report", with their states in
  English

