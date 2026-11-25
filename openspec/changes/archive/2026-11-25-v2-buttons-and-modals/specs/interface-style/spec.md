## ADDED Requirements

### Requirement: Buttons share the v2 look

Every button of the web SHALL show its label in sentence case, never in uppercase, with round corners and no shadow. A contained primary button SHALL be the flow's blue with white text, and an outlined primary one SHALL be blue text on white with a border. A screen MAY style a button its own way, but SHALL NOT fall back to the framework's uppercase look.

#### Scenario: A stage's main action

- **WHEN** the user has loaded farms on the upload page
- **THEN** the button to validate them reads "Validar polígonos", in sentence case, on the flow's blue

#### Scenario: A modal's actions

- **WHEN** the user opens the report's download modal
- **THEN** "Descargar GeoJSON" and "Descargar PDF" are in sentence case, in a footer under the content

### Requirement: Modals share one heading

Every modal SHALL open with the same heading: the title in the heading font, an optional icon in a tinted tile (blue, amber for a warning, red for an error), an optional subtitle, a line under it, and a close button unless the modal closes from its own button. The dialog SHALL be named by its title alone, without the subtitle or the close button. Tables inside a modal SHALL use the stage pages' table look.

#### Scenario: Changing country after an analysis

- **WHEN** the user picks another country after an analysis
- **THEN** the modal that warns about restarting shows an amber tile and is named "Cambiar de país reinicia el análisis"

#### Scenario: A farm's detail

- **WHEN** the user opens a farm of the validation results
- **THEN** the modal's heading shows the polygon or point icon and "Polígono · ID <id>", and its points are in the stage pages' table
