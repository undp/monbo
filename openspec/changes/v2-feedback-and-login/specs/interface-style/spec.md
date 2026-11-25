## ADDED Requirements

### Requirement: Feedback and waits share the v2 look

The web's notices (snackbars), its loading screen and its progress dialogs SHALL use the stage pages' look: white cards with the stage pages' hairline and shadow, ink texts, and the flow's colors for their accents. A notice SHALL show its type (success, information, warning, error) through its icon and edge color, not through a filled background. The loading screen SHALL fit under the flow header without making the page scroll on a 1366×768 screen.

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
