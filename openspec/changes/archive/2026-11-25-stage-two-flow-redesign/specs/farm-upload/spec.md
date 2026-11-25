## RENAMED Requirements

- FROM: `### Requirement: The stage 1 list is kept while the user visits the results`
- TO: `### Requirement: The flow's upload list is kept across its stages`

## MODIFIED Requirements

### Requirement: The flow's upload list is kept across its stages

The upload list SHALL belong to the flow, not to a stage: `/polygons-validation/upload-data` and
`/territorial-analysis/upload-data` SHALL show and edit the same list, kept in the flow's browser
state. It SHALL hold its sources, the deleted rows and the manual farms. Going to another page or
stage and back SHALL show the same list. Nothing about it SHALL be stored on the server. A refresh
or starting over SHALL clear it.

Neither upload page SHALL parse or validate the list on entry: stage 1 validates it only when the
user presses "Validar", and stage 2 parses it only when the user presses "Continuar".

#### Scenario: Back from the results

- **WHEN** the user validates an Excel and a drawn farm, then opens the upload page from "Agregar
  más polígonos"
- **THEN** the list shows the Excel's farms and the drawn farm, and no validation runs until the
  user presses the button

#### Scenario: Farms uploaded on stage 2

- **WHEN** the user uploads a file on the stage 2 upload page, presses "Continuar", and then opens
  the stage 1 upload page
- **THEN** the stage 1 list shows the same file's farms, and nothing is validated until the user
  presses "Validar"

#### Scenario: Back to the polygons from the layers

- **WHEN** the user uploaded an Excel and drew a farm on stage 2, pressed "Continuar", and then
  pressed "Ver polígonos" on the layers page
- **THEN** the stage 2 upload page lists the Excel's farms and the drawn farm

## ADDED Requirements

### Requirement: Confirming the list keeps the results that still describe it

Stage 2's "Continuar" SHALL compare the upload list with the one the loaded farms were parsed
from. When the list changed, the new farms SHALL replace the earlier ones, and the validation
results and the analysis results of the earlier farms SHALL be dropped. When it didn't change,
"Continuar" SHALL keep the farms, the validation results and the analysis results, and go to the
layers page. Stage 1's "Validar" SHALL always parse and validate the list again, and drop the
analysis results, as it does today.

Emptying the list SHALL NOT drop the loaded farms or their results by itself. While farms are
loaded, both upload pages SHALL keep their bottom bar with an emptied list, saying it is empty,
with the button off until the list has a farm again.

#### Scenario: An unchanged list

- **WHEN** the user analysed the farms of an Excel, opened the stage 2 upload page through "Ver
  polígonos" and pressed "Continuar" without changes
- **THEN** the layers page opens, and stage 2 still has its results

#### Scenario: A row deleted

- **WHEN** the user analysed the farms of an Excel, opened the stage 2 upload page, deleted a row
  and pressed "Continuar"
- **THEN** the layers page opens with one polygon fewer, and the earlier analysis results are
  dropped

#### Scenario: Validating again an unchanged list

- **WHEN** the user analysed the farms of an Excel, opened the stage 1 upload page and pressed
  "Validar" without changes
- **THEN** the farms are validated again and the analysis results are dropped

#### Scenario: The list emptied

- **WHEN** the user analysed the farms of an Excel, opened the stage 2 upload page and pressed
  "Quitar todos"
- **THEN** the bar stays, says the list is empty, and its "Continuar" is off; the farms and their
  results stay until a new list is confirmed
