# territorial-analysis Specification

## Purpose
TBD - created by archiving change territorial-analysis-by-category. Update Purpose after archive.
## Requirements
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

The stage 2 selection page (`/territorial-analysis/layers`) SHALL show the selected country's
layers in a "Capas para el análisis" section, grouped by category in the order `GET /categories`
returns them. The section SHALL link "Cómo leer cada capa" to the methodology page, opened in a new
tab. Each category SHALL be a card with its icon, color, name and description in the UI language,
and how many of its layers are ticked out of how many it has ("3 de 3 capas"). Each layer SHALL be
a card with a checkbox, its name and, when known, its source, its period
(`baseline → comparedAgainst`) and its resolution; a ticked layer's card SHALL be outlined in its
category's color. A category with no layer for the country SHALL NOT be shown. Ticking a layer
SHALL NOT start the analysis.

#### Scenario: Three categories in Colombia

- **WHEN** Colombia has the categories Deforestación, Áreas protegidas and Frontera agrícola, each
  with at least one layer
- **THEN** the page shows three category cards in that order, each with its layers as checkbox
  cards

#### Scenario: Ticking layers

- **WHEN** the user ticks two of the three deforestation layers
- **THEN** the deforestation card reads "2 de 3 capas", the two layer cards are outlined in the
  category's color, and no analysis starts

### Requirement: The polygon subset is chosen on the page

The stage 2 selection page SHALL show, above the layers, a banner with how many polygons the
analysis will use and a "Ver polígonos" link:
- When validation results exist, the banner SHALL let the user choose between the valid polygons
  and all of them, with the valid ones selected by default. With the valid ones, it SHALL name the
  polygons left out (up to three IDs, then how many more). "Ver polígonos" SHALL go to
  `/polygons-validation`.
- Without validation results, the banner SHALL only inform: the analysis uses every loaded
  polygon, and they were not validated. "Ver polígonos" SHALL go to
  `/territorial-analysis/upload-data`, with the list as the user left it.

The analysis SHALL use the subset shown on the page when it starts.

#### Scenario: After a validation

- **WHEN** 5 polygons were validated and CO-0005 is not valid
- **THEN** the banner says the analysis will use the 4 valid polygons, that CO-0005 is left out,
  and offers all (5) instead

#### Scenario: Choosing all polygons

- **WHEN** the user chooses all polygons and presses "Analizar"
- **THEN** the results show the 5 polygons

#### Scenario: Without a validation

- **WHEN** the user uploaded 6 polygons on stage 2 without validating them
- **THEN** the banner says the analysis will use the 6 polygons, that they were not validated, and
  offers no choice

#### Scenario: Seeing the polygons after a validation

- **WHEN** the polygons were validated and the user presses "Ver polígonos"
- **THEN** the browser goes to `/polygons-validation`

#### Scenario: Seeing the polygons uploaded on stage 2

- **WHEN** the polygons were uploaded on stage 2 and the user presses "Ver polígonos"
- **THEN** the browser goes to `/territorial-analysis/upload-data`, which lists them

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

When no farms are loaded, stage 2 SHALL open on `/territorial-analysis/upload-data`, titled
"Análisis territorial" under "Etapa 2 de 3", with the same upload as stage 1: the method cards,
the list of loaded polygons and points, and a bottom bar with their count. The bar's button SHALL
read "Continuar": it SHALL parse the list and go to `/territorial-analysis/layers`, without
starting an analysis. Stage 2 SHALL NOT be blocked: nothing has to be validated first. Opening
`/territorial-analysis/layers` with no farms loaded SHALL go to `/territorial-analysis/upload-data`.

#### Scenario: Entering stage 2 directly

- **WHEN** the user opens stage 2 with no farms loaded
- **THEN** the browser shows `/territorial-analysis/upload-data` with the method cards and an
  empty list

#### Scenario: Continuing to the layers

- **WHEN** the user uploads an Excel of 6 farms there and presses "Continuar"
- **THEN** the browser goes to `/territorial-analysis/layers`, the banner counts 6 polygons, and
  no analysis starts

#### Scenario: Layers page without farms

- **WHEN** the user opens `/territorial-analysis/layers` with no farms loaded
- **THEN** the browser goes to `/territorial-analysis/upload-data`

### Requirement: The analysis starts only when the user asks

The stage 2 selection page SHALL start the analysis only when the user presses "Analizar" in its
bottom bar, with farms and at least one layer. The bar SHALL read how many polygons, layers and
categories the analysis covers ("5 polígonos · 5 capas en 3 categorías"). Uploading or confirming
polygons SHALL NOT start an analysis. Opening the page SHALL NOT start an analysis, whatever farms,
layers and subset are loaded, except to recalculate an analysis invalidated by a layer change,
which reuses the subset and layers already chosen.

#### Scenario: Back button after a validation

- **WHEN** the user ticked layers on stage 2, then uploaded and validated farms on stage 1, and
  went back with the browser's back button to `/territorial-analysis/layers`
- **THEN** no analysis starts, the subset choice and the ticked layers are shown, and the analysis
  starts only when the user presses "Analizar"

#### Scenario: Upload doesn't analyse

- **WHEN** the user uploads polygons on stage 2 and presses "Continuar" with layers already ticked
- **THEN** the layers page opens and no analysis starts until "Analizar" is pressed

#### Scenario: Outdated analysis

- **WHEN** a layer of the current analysis changed and the analysis was invalidated
- **THEN** opening the results sends the user to `/territorial-analysis/layers`, which
  recalculates it with the same subset and layers

### Requirement: Results summarised per category

The stage 2 results page SHALL show one summary card per analysed category with its icon, name and
how many of its layers were analysed, its main figure "N de M" with the category's `ok` result
label, and a bar split by how many of the visible farms are `ok`, `flagged` ("Con
observaciones") and `unknown` ("Sin dato") for that category. A farm SHALL be `flagged` in a
category when any of the category's analysed layers classifies it `flagged`; otherwise `unknown`
when any of them classifies it `unknown`; otherwise `ok`.

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

#### Scenario: The main figure

- **WHEN** 4 of 5 farms are `ok` in Deforestación, analysed with 3 layers
- **THEN** its card reads "3 capas" and "4 de 5 libre de deforestación"

### Requirement: Results table grouped by category

The stage 2 results table SHALL be in a "Resultado por polígono y capa" section, subtitled
"Porcentaje del polígono que coincide con cada capa", with the search and the map toggle in the
section's header. It SHALL use the flow's table style: the ID in blue, uppercase headers, and the
farm columns ID and Productor. It SHALL show a header row that groups the layer columns by
category, with the category's icon, color and name over its layers, and layer columns ordered by
category. Each cell SHALL be a pill with the result of its layer for the farm: a check and the
category's `ok` label when `ok`; the finding percentage and the category's `flagged` label when
`flagged`, in the flagged color; "Sin dato" when `unknown`. The finding SHALL be `value` for
`avoid` and `1 − value` for `required`. A flagged finding SHALL never read as "0%" nor as the
threshold itself: with a threshold of 0, a finding under 0.1% reads "< 0,1%"; with a threshold of
5, a finding of 5.04% reads "> 5%". The table SHALL keep its search, sorting and per-layer `ok`
counter, and SHALL keep the props the report stage uses (`tableProps`, `mapsSubset`); the report
stage SHALL keep its own farm columns.

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

#### Scenario: Searching

- **WHEN** the user types "CO-0002" in the section's search
- **THEN** the table shows only that farm

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

### Requirement: The results page follows the flow's layout

The stage 2 results page (`/territorial-analysis`) SHALL use the flow's page layout, as wide as the
stepper. Its head SHALL show "Etapa 2 de 3", the title "Resultados del análisis territorial", and
how many polygons were crossed with how many layers of the country. "Cambiar capas" and the
download (Excel or GeoJSON) SHALL be at the head's right. "Cambiar capas" SHALL open
`/territorial-analysis/layers` with the choices of the results on screen. The section's
"Ver en el mapa" SHALL switch it to the map (`?view=map`), and the map SHALL offer "Ver tabla" to
switch back. The page SHALL end with the next-stage card for "Reporte", whose "Continuar" opens the
report layer modal.

#### Scenario: The head

- **WHEN** 5 polygons were analysed with 5 layers in Colombia
- **THEN** the head reads "Resultados del análisis territorial" and "5 polígonos cruzados con 5
  capas de Colombia.", with "Cambiar capas" and the download at its right

#### Scenario: To the map and back

- **WHEN** the user presses "Ver en el mapa" and then "Ver tabla"
- **THEN** the section shows the map with `?view=map`, and then the table again

#### Scenario: Changing layers

- **WHEN** the user presses "Cambiar capas"
- **THEN** the browser goes to `/territorial-analysis/layers` with the analysed layers ticked

### Requirement: Analysed layer texts follow the UI language

The texts of the analysed layers (name, alias, coverage, source, resolution, content date, update
frequency, publish date and considerations) SHALL be shown in the current UI language in the
"Detalles de las capas" modal and in the Excel and GeoJSON exports, also after the user switched
the language with an analysis loaded. Switching the language SHALL NOT run the analysis again nor
change a layer's calculation fields (version, pixel size, baseline, compared year, category).

While an analysis has results, the web SHALL keep the texts of its layers in every UI language,
fetching `GET /maps` once for each language it has not seen them in. A layer hidden after the
analysis (no longer listed by `GET /maps`) SHALL take its texts in the current language from what
was kept. When those texts were never received (the extra fetch failed), the layer SHALL keep its
last texts.

#### Scenario: Modal after a language change

- **WHEN** GFW was analysed in English, the user switches to Spanish and opens "Detalles de las
  capas"
- **THEN** the chip and every detail of the first layer are the Spanish texts of
  `GET /maps?language=es`, without clicking another chip

#### Scenario: Hidden layer in the exports

- **WHEN** GFW and "Áreas test" were analysed in Spanish, the category of "Áreas test" is then
  disabled, and the user switches to English and exports the Excel
- **THEN** the columns of the hidden layer name it with its English alias ("Test areas"), under
  "No category"

#### Scenario: Texts of the other language unavailable

- **WHEN** the extra `GET /maps` in English failed, a layer is then hidden, and the user switches
  to English
- **THEN** that layer keeps its Spanish texts, and its results stay

### Requirement: The map view survives a Google Maps key that fails

When the Google Maps key is missing or invalid, the stage 2 map view SHALL show the map's own
error and SHALL NOT take the page down: going back to the table, or changing the layer on the
map, SHALL keep the results page working. Leaving the map SHALL NOT fail because Google Maps
disabled its API after rejecting the key.

#### Scenario: Back to the table with an invalid key

- **WHEN** the web runs with an invalid `NEXT_PUBLIC_GCP_MAPS_PLATFORM_API_KEY`, the user opens
  the map view of the results and then chooses "Ver tabla"
- **THEN** the results table shows, and the page does not switch to the global error page

#### Scenario: Changing the layer on a map that failed to load

- **WHEN** the map view shows Google's error because the key was rejected and the user picks
  another layer in the map's layer selector
- **THEN** the page keeps working, with that layer's farm groups in the list

