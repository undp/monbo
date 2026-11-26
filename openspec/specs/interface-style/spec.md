# interface-style Specification

## Purpose
TBD - created by archiving change v2-buttons-and-modals. Update Purpose after archive.
## Requirements
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

### Requirement: Feedback and waits share the v2 look

The web's notices (snackbars), its loading screen and its progress dialogs SHALL use the stage pages' look: white cards with the stage pages' hairline and shadow, ink texts, and the flow's colors for their accents. A notice SHALL show its type (success, information, warning, error) through its icon and edge color, not through a filled background. The loading screen SHALL fit under the flow header without making the page scroll in a viewport of 1366×768.

#### Scenario: A notice after the validation

- **WHEN** the validation finishes and the page says "Datos analizados correctamente"
- **THEN** the notice is a white card with a green check and a green left edge

#### Scenario: Waiting for the validation

- **WHEN** the user sends the farms to validate and the API takes a while
- **THEN** a white card with a blue spinner and "Cargando los datos" shows under the flow header, as wide as the page's body

### Requirement: Icon-only controls are named

Every control that shows only an icon SHALL have an accessible name in the user's language, and a button that opens a menu of formats SHALL say what it does in its text.

#### Scenario: Downloading the results

- **WHEN** the user looks for the download on the validation or analysis results
- **THEN** an outlined button reads "Descargar" and opens the list of formats

#### Scenario: The detail map's controls

- **WHEN** a screen reader reaches the controls of a farm's detail map
- **THEN** they are announced as "Centrar el mapa", "Acercar" and "Alejar"

### Requirement: Result colors come from the theme

The result-class colors of `utils/styling.ts` (ok, flagged and no data, as text and background),
the flagged and no-data segments of the summary meter, the no-data chip, the background of the
neutral chip and the layer's swatch in the map legend SHALL be defined once, in the theme's
`result` palette, and components SHALL read them from there. The PDF report SHALL use the same
values.

#### Scenario: A no-data chip

- **WHEN** a layer has no result for any farm and its counter chip is shown
- **THEN** the chip's background and text use the theme's no-data colors

#### Scenario: Changing a result color

- **WHEN** the theme's flagged meter color is changed
- **THEN** the summary cards' meter paints its flagged segment in the new color, with no other file edited

### Requirement: The page eyebrow is legible

The eyebrow above a page's title SHALL have a contrast of at least 4.5:1 against white and against
the stage pages' light blue (`#f4f9fd`).

#### Scenario: Methodology page

- **WHEN** the user opens the methodology page
- **THEN** the "Metodología" eyebrow is painted in a green with at least 4.5:1 contrast on its background

