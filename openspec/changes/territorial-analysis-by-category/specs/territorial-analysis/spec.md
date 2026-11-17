## ADDED Requirements

### Requirement: The web knows the country's categories

The web SHALL fetch the selected country's categories from `GET /categories?country=CC` together
with its layers, and SHALL show a country's layers only with that same country's categories. If
the categories can't be fetched, the layer selectors SHALL show the message for layers that could
not be loaded, not ungrouped layers.

#### Scenario: Layers and categories arrive together

- **WHEN** the user selects Colombia and the API answers `GET /maps` and `GET /categories`
- **THEN** stage 2 shows Colombia's layers grouped under Colombia's categories

#### Scenario: Categories fail

- **WHEN** `GET /categories` fails for the selected country
- **THEN** stage 2 shows that the layers could not be loaded, and no layer can be ticked

### Requirement: Layers are chosen by category

The stage 2 selection page SHALL show the selected country's layers grouped by category, in the
order `GET /categories` returns them. Each category SHALL show its icon, color, name and
description in the UI language, and how many of its layers are ticked out of how many it has.
Each layer SHALL be a checkbox with its name and, when known, its source, its period
(`baseline → comparedAgainst`) and its resolution. A category with no layer for the country SHALL
NOT be shown. Ticking a layer SHALL NOT start the analysis.

#### Scenario: Three categories in Colombia

- **WHEN** Colombia has the categories Deforestación, Áreas protegidas and Frontera agrícola, each
  with at least one layer
- **THEN** the page shows three category groups in that order, each with its layers as checkboxes

#### Scenario: Ticking layers

- **WHEN** the user ticks two of the three deforestation layers
- **THEN** the deforestation group reads "2 de 3 capas" and no analysis starts

### Requirement: The polygon subset is chosen on the page

When validation results exist, the stage 2 selection page SHALL show how many polygons the
analysis will use and let the user choose between the valid polygons and all of them, with the
valid ones selected by default. Without validation results, the analysis SHALL use every loaded
polygon. The analysis SHALL use the subset shown on the page when it starts.

#### Scenario: After a validation

- **WHEN** 5 polygons were validated and 1 is not valid
- **THEN** the page says the analysis will use the 4 valid polygons and offers "all (5)" instead

#### Scenario: Choosing all polygons

- **WHEN** the user chooses all polygons and presses "Analizar"
- **THEN** the results show the 5 polygons

### Requirement: The page's choices are a draft until analysed

The layers and the polygon subset chosen on the stage 2 selection page SHALL be kept apart from
the layers and subset the current results were analysed with. Changing them SHALL NOT change the
results page, the map, the summary or the report until an analysis started from the page
succeeds; then the results and the choices they were analysed with SHALL change together. The
page SHALL keep its choices while the user visits another stage, including through a
recalculation of the analysed choices, and "Cambiar capas" SHALL open it with the choices of the
results on screen.

#### Scenario: Choices changed and abandoned

- **WHEN** 6 valid polygons of 10 were analysed with GFW, TMF and IDEAM, and on the selection page
  the user unticks IDEAM, chooses all polygons and goes back to the results with the browser's
  back button without pressing "Analizar"
- **THEN** the results still show the 6 valid polygons and the three layers, no invalid polygon
  appears as free, and the report offers the same three layers

#### Scenario: A recalculation keeps the draft

- **WHEN** GFW and IDEAM were analysed, the user picked GFW and TMF on the page without analysing,
  and a change to GFW triggered a recalculation
- **THEN** the recalculation sends GFW and IDEAM, and the page still shows GFW and TMF afterwards

#### Scenario: Choices analysed

- **WHEN** the user then presses "Analizar" on the selection page and the analysis succeeds
- **THEN** the results show 10 polygons and two layers

### Requirement: A hidden layer never enters an analysis

An analysis started from the stage 2 selection page SHALL send only layers the country offers
now (listed by `GET /maps`, with a listed category). A layer hidden after it was chosen or
analysed SHALL NOT be sent, shown as a choice, or counted in the page's summary. It MAY stay in
the current results until a new analysis replaces them.

#### Scenario: Category disabled after the analysis

- **WHEN** GFW, TMF and IDEAM were analysed, TMF's category is then disabled, and the user presses
  "Analizar" on the selection page
- **THEN** the request's `maps` are GFW and IDEAM, and the page's summary counts two layers

### Requirement: Direct entry without polygons

When no farms are loaded, the stage 2 selection page SHALL show a notice that the user came in
directly, with an action to upload polygons on the page and one to go to the validation stage.
Stage 2 SHALL NOT be blocked: the layers can be chosen and a file uploaded on the page.

#### Scenario: Entering stage 2 directly

- **WHEN** the user opens `/deforestation-analysis/upload-data` with no farms loaded
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
  went back twice with the browser's back button to `/deforestation-analysis/upload-data`
- **THEN** no analysis starts, the subset choice and the ticked layers are shown, and the analysis
  starts only when the user presses "Analizar"

#### Scenario: Outdated analysis

- **WHEN** a layer of the current analysis changed and the analysis was invalidated
- **THEN** opening the page recalculates it with the same subset and layers

### Requirement: Results summarised per category

The stage 2 results page SHALL show one summary per analysed category with how many of the
visible farms are `ok`, `flagged` ("Con observaciones") and `unknown` ("Sin dato") for that
category. A farm SHALL be `flagged` in a category when any of the category's analysed layers
classifies it `flagged`; otherwise `unknown` when any of them classifies it `unknown`; otherwise
`ok`. The main figure SHALL use the category's `ok` result label.

#### Scenario: A finding in one of two layers

- **WHEN** a farm is `ok` in GFW and `flagged` in TMF, both in Deforestación
- **THEN** it counts as "Con observaciones" in Deforestación

#### Scenario: No data does not count as ok

- **WHEN** a farm is `ok` in GFW and `unknown` in TMF
- **THEN** it counts as "Sin dato" in Deforestación, not as "Libre de deforestación"

#### Scenario: Agricultural frontier

- **WHEN** Frontera agrícola is `required` with a threshold of 5, and a farm's value for its layer
  is `0.82`
- **THEN** the farm counts as "Con observaciones" in Frontera agrícola

### Requirement: Results table grouped by category

The stage 2 results table SHALL show a header row that groups the layer columns by category, with
the category's icon, color and name over its layers, and layer columns ordered by category. Each
cell SHALL show the result of its layer for the farm: the category's `ok` label when `ok`; the
finding percentage and the category's `flagged` label when `flagged`; "Sin dato" when `unknown`.
The finding SHALL be `value` for `avoid` and `1 − value` for `required`. A flagged finding SHALL
never read as "0%" nor as the threshold itself: with a threshold of 0, a finding under 0.1% reads
"< 0,1%"; with a threshold of 5, a finding of 5.04% reads "> 5%". The table SHALL
keep its
search, sorting and per-layer `ok` counter, and SHALL keep the props the report stage uses
(`tableProps`, `mapsSubset`).

#### Scenario: A farm outside the agricultural frontier

- **WHEN** Frontera agrícola is `required` with a threshold of 5 and its labels are "Dentro de la
  frontera agrícola" / "Fuera de la frontera agrícola", and a farm's value for its layer is `0.82`
- **THEN** the cell reads "18% · Fuera de la frontera agrícola" in the flagged color

#### Scenario: Under the threshold

- **WHEN** Deforestación has a threshold of 2 and a farm's GFW value is `0.005`
- **THEN** the cell reads "Libre de deforestación", without a percentage

#### Scenario: A tiny finding with a threshold of 0

- **WHEN** Áreas protegidas is `avoid` with a threshold of 0 and a farm's value for its layer is
  `0.0004`
- **THEN** the cell reads "< 0,1% · Dentro de un área protegida", not "0% · …"

#### Scenario: A finding just above the threshold

- **WHEN** Frontera agrícola is `required` with a threshold of 5 and a farm's value is `0.9496`
- **THEN** the cell reads "> 5% · Fuera de la frontera agrícola", not "5% · …"

#### Scenario: Grouped header

- **WHEN** the analysis used GFW and TMF (Deforestación) and UPRA (Frontera agrícola)
- **THEN** the header shows "Deforestación" over the GFW and TMF columns and "Frontera agrícola"
  over the UPRA column

### Requirement: The map uses the layer's category

The stage 2 map view SHALL name its farm groups with the selected layer's category labels
(`flagged`, `ok`, and "Sin dato" when it has farms), classify farms with that category's rule,
and group the layer selector by category, with the category's color and icon. A layer's counter
of farms without findings SHALL show the category's icon on the theme's success color (green),
never on the category's color, so it doesn't read as a finding. A farm with no data SHALL read
"Sin dato" in its group, its chip and the counters alike. Layer tiles SHALL keep their current
color.

#### Scenario: Selecting a frontier layer on the map

- **WHEN** the user selects UPRA in the map's layer selector
- **THEN** the groups read "Fuera de la frontera agrícola" and "Dentro de la frontera agrícola",
  and a farm with value `0.82` is in the first one

### Requirement: Stage 2 texts are translated

Every new stage 2 text SHALL come from i18next with its key in `es` and `en`. Category names,
descriptions and result labels SHALL be shown in the UI language from the texts the API returns.

#### Scenario: English UI

- **WHEN** the UI is in English
- **THEN** category names and result labels are the `en` texts of `GET /categories`
