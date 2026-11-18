## MODIFIED Requirements

### Requirement: Direct entry without polygons

When no farms are loaded, the stage 2 selection page SHALL show a notice that the user came in
directly, with an action to upload polygons on the page and one to go to the validation stage.
Stage 2 SHALL NOT be blocked: the layers can be chosen and a file uploaded on the page.

#### Scenario: Entering stage 2 directly

- **WHEN** the user opens `/territorial-analysis/upload-data` with no farms loaded
- **THEN** the page shows the notice with "Subir polígonos" and "Ir a validación", and the layers
  and the upload step are usable

#### Scenario: Going to validation from the notice

- **WHEN** the user presses "Ir a validación"
- **THEN** the browser goes to `/polygons-validation/upload-data`

### Requirement: The analysis starts only when the user asks

The stage 2 selection page SHALL start the analysis only when the user presses "Analizar" with
farms and at least one layer, or after a file uploaded on the page is parsed with at least one
layer ticked. Opening the page SHALL NOT start an analysis, whatever farms, layers and subset are
loaded, except to recalculate an analysis invalidated by a layer change, which reuses the subset
and layers already chosen.

#### Scenario: Back button after a validation

- **WHEN** the user ticked layers on stage 2, then uploaded and validated farms on stage 1, and
  went back twice with the browser's back button to `/territorial-analysis/upload-data`
- **THEN** no analysis starts, the subset choice and the ticked layers are shown, and the analysis
  starts only when the user presses "Analizar"

#### Scenario: Outdated analysis

- **WHEN** a layer of the current analysis changed and the analysis was invalidated
- **THEN** opening the page recalculates it with the same subset and layers
