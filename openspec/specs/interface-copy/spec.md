# interface-copy Specification

## Purpose
TBD - created by archiving change neutral-spanish-copy. Update Purpose after archive.
## Requirements
### Requirement: Spanish copy is neutral and uses tú

Every Spanish text the web shows, in `locales/es/` and in the methodology Markdown of `content/documentation/es/`, SHALL address the user with `tú`. It SHALL NOT use `usted`, voseo, or words specific to one Spanish-speaking country where a word shared by Colombia and Ecuador exists ("mantenedor", "calzar", "naranjo" as a color, "chica" as a size), nor anglicisms with a common Spanish equivalent ("click", "feedback"). Titles, buttons and column headers SHALL use sentence case.

#### Scenario: Admin title

- **WHEN** an admin opens any admin page in Spanish
- **THEN** the header reads "Administración de capas", not "Mantenedor de capas"

#### Scenario: Layer whose years do not match its category

- **WHEN** a published layer has years that do not fit its category
- **THEN** the reason reads "sus años no coinciden con su categoría.", without "calzan"

#### Scenario: Overlap colors in the methodology

- **WHEN** the user reads how overlaps are colored on the methodology page in Spanish
- **THEN** the medium level is called "naranja"

#### Scenario: Upload drop zone

- **WHEN** the upload drop zone is idle
- **THEN** its button reads "Haz clic para cargar"

### Requirement: Generic texts do not say deforestation

A text that applies to every layer category SHALL use generic wording ("análisis territorial", "capa", "categoría") instead of "deforestación" / "deforestation", in both locales. "Deforestación" SHALL remain only where the text names the deforestation category, a deforestation layer, or a forest-loss example. Category names and result labels come from the API and are not part of this requirement.

#### Scenario: Changing the country after an analysis

- **WHEN** the user changes the country after running stage 2
- **THEN** the warning says they already ran a territorial analysis ("Ya hiciste un análisis territorial"), without "deforestación"

#### Scenario: Satellite image on the results map

- **WHEN** the results map shows the Google Maps satellite image
- **THEN** its disclaimer says the image is a reference and does not show the layer's result, without "deforestación"

#### Scenario: Usage dashboard

- **WHEN** an admin opens the usage page
- **THEN** the analysis tile reads "Análisis territoriales" / "Territorial analyses", and the funnel subtitle does not mention deforestation

#### Scenario: Example of a category to avoid

- **WHEN** the admin reads the help of the "Lo que se debe evitar" polarity option
- **THEN** it still names forest loss as an example

### Requirement: Every visible text goes through i18next

Every string the web shows or announces to assistive technology, including accessible labels, the default texts of MUI components (such as the `closeText` of a closable `Alert`) and the sheet names of exported Excel files, SHALL come from an i18next key present in both `locales/es/` and `locales/en/`. The validation export's bilingual header rows, which follow the upload template's layout, are exempt. No key SHALL contain the misspelling "analized", and no English text SHALL read "analized".

#### Scenario: Close button of a modal

- **WHEN** a screen reader focuses the close button of a modal in Spanish
- **THEN** it announces "Cerrar"

#### Scenario: Close button of a snackbar or an alert

- **WHEN** a snackbar or a closable alert shows in Spanish
- **THEN** its close button announces "Cerrar", not MUI's default "Close"

#### Scenario: Empty chart in the usage page

- **WHEN** the funnel, the outcomes or the weekly chart of the usage page has only zeros for the chosen range
- **THEN** it shows "Sin datos en este rango." / "No data in this range." in place of the chart, instead of lines and bars at 0

#### Scenario: Validation export in English

- **WHEN** the user downloads the validation results in English
- **THEN** the workbook's sheets are named in English

#### Scenario: Analysis success message in English

- **WHEN** an analysis finishes and the interface is in English
- **THEN** the message reads "Data analyzed successfully"

### Requirement: Literal keys exist in the namespace they name

Every translation key written in the code as a string literal `"namespace:key"`, whether it is passed to `t()` directly, chosen in a ternary, kept in a constant or passed as a prop, SHALL name a text (a string, or the forms of a plural) that exists in that namespace, in `es` and in `en`. No text SHALL depend on the fallback to `common` to show, and no key SHALL name a group of texts. A key that exists only as a plural SHALL have both its `_one` and `_other` forms in both languages, and a text that shows a count next to a noun SHALL be a plural ("1 polígono validado", not "1 polígonos validados"). Keys built at runtime (a template literal such as `` `${prefix}:title` `` or a variable) are exempt, because their value is only known when the code runs.

#### Scenario: Testing-environment warning

- **WHEN** the testing-environment warning renders
- **THEN** it reads `common:devWarning`, which exists in `common`, and not `home:devWarning`

#### Scenario: A key missing from its namespace

- **WHEN** a component reads a literal key that its namespace does not define, even from a ternary or a constant
- **THEN** the test suite fails and names the file and the key

#### Scenario: A plural without its singular form

- **WHEN** a plural key used with `count` has `_other` but not `_one` in one language
- **THEN** the test suite fails and says the key is missing a plural form

#### Scenario: One valid polygon

- **WHEN** the validation has one valid polygon
- **THEN** its tab reads "1 polígono validado"

#### Scenario: A key that names a group of texts

- **WHEN** the code holds a literal key such as `"common:snackbarAlerts"`, which names an object of texts
- **THEN** the test suite fails and says the key is not a text

