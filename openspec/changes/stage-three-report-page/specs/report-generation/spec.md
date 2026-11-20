## ADDED Requirements

### Requirement: The report is one page with its choices and its preview

`/report-generation` SHALL show "Etapa 3 de 3", a page head, a sidebar and a preview panel:
- **"Polígonos":**
  - a search by ID or producer;
  - "Seleccionar todos";
  - one row per polygon of the analysis, with a checkbox, its ID and its producer.
- **"Capas del reporte":** the analysis's layers, grouped by category, in one column, each with
  a checkbox.
- **Below the two sections:** "Generar vista previa" and "Descargar".
- **The preview panel:** the PDF, or the state that stands in for it.

On a narrow screen the sidebar SHALL come before the preview panel. Only the layers of the current
analysis SHALL be offered: a layer that wasn't analysed has no results to report.

"Seleccionar todos" SHALL act on the polygons the search lists: with no search, all of them. It
SHALL show as ticked when every listed polygon is ticked, as indeterminate when only some are,
and as unticked when none is.

#### Scenario: The page's parts

- **WHEN** the user opens `/report-generation` with analysis results
- **THEN** the page shows "Etapa 3 de 3", the "Polígonos" and "Capas del reporte" sections,
  "Generar vista previa", "Descargar" and the preview panel

#### Scenario: Select all within a search

- **WHEN** every polygon is ticked, the user searches "P-01" and unticks "Seleccionar todos"
- **THEN** only the polygons the search lists are unticked, and the others stay ticked

#### Scenario: Only analysed layers

- **WHEN** the analysis ran with two of the country's five layers
- **THEN** "Capas del reporte" lists those two layers only

### Requirement: The report starts with every polygon and every layer

The first time the report page opens for an analysis, it SHALL tick every polygon of the analysis
and every analysed layer. After that, the user's choice SHALL be kept when the user leaves and
comes back, including an empty one. A new analysis, an invalidated analysis, new farms or starting
over SHALL drop the choice, and the page SHALL set the defaults again on its next visit.

#### Scenario: First visit

- **WHEN** the analysis covered 12 polygons and 3 layers, and the user opens the report page for
  the first time
- **THEN** the 12 polygons and the 3 layers are ticked, and "Seleccionar todos" is ticked

#### Scenario: Back to the report

- **WHEN** the user unticked 2 polygons, went to the stage 2 results and came back to the report
- **THEN** those 2 polygons are still unticked

#### Scenario: A new analysis

- **WHEN** the user chose some polygons for the report, then ran the analysis again and opened the
  report
- **THEN** every polygon and every layer of the new analysis are ticked

### Requirement: Polygon rows summarise their results by category

Each polygon row SHALL show one icon per category that has a ticked report layer. The icon SHALL
take the colour of the category's worst result for that polygon among its ticked layers:
- flagged when any layer is flagged;
- no data when none is flagged and any layer has no result;
- ok otherwise.

The icon's tooltip SHALL list each ticked layer of the category with its finding, written as on
the stage 2 results table: the percentage, the ok label, or "Sin dato". For example: "GFW 3,42 % ·
TMF 1,18 % · IDEAM Libre". The classes SHALL come from the category's rule (`classifyResult`), and
the icon SHALL have an accessible name with the category and its result.

#### Scenario: One layer flagged

- **WHEN** a polygon is flagged on GFW and ok on TMF, both deforestation layers ticked
- **THEN** its deforestation icon has the flagged colour, and its tooltip lists GFW's percentage
  and TMF's ok label

#### Scenario: A layer without a result

- **WHEN** a polygon is ok on GFW and has no result on TMF
- **THEN** its deforestation icon has the no-data colour, and the tooltip says "Sin dato" for TMF

#### Scenario: An unticked layer

- **WHEN** the user unticks the only flagged layer of a category
- **THEN** the icon is recomputed without it

### Requirement: The preview is rendered on request

The page SHALL render no PDF until the user presses "Generar vista previa". Until then the preview
panel SHALL show an empty state that explains what the button does. Pressing it SHALL render the
preview of the current choice. The panel SHALL show progress while it renders, then the PDF, or the
error with "Reintentar" (see "A failed preview can be retried").

"Generar vista previa" SHALL be off while no polygon or no layer is ticked, and the page SHALL say
which is missing. It SHALL also be off while the shown preview matches the current choice.

Leaving the page SHALL drop the preview. Coming back SHALL show the empty state again, with the
choice kept.

#### Scenario: Nothing is rendered on entry

- **WHEN** the user opens the report page
- **THEN** no report images are requested and no PDF is rendered, and the preview panel shows the
  empty state

#### Scenario: Generate the preview

- **WHEN** the user presses "Generar vista previa" with 5 polygons and 2 layers ticked
- **THEN** the preview of those 5 polygons and 2 layers is rendered and shown

#### Scenario: No polygon ticked

- **WHEN** the user unticks every polygon
- **THEN** "Generar vista previa" is off and the page says that at least one polygon is needed

### Requirement: A changed choice leaves the preview stale

After a preview was shown, a change to the ticked polygons or layers SHALL NOT render it again on
its own. The panel SHALL keep the shown PDF with a notice that it doesn't match the current choice,
and an "Actualizar vista previa" button that renders the preview of the current choice. That button
SHALL follow "Generar vista previa": it SHALL be off while no polygon or no layer is ticked, with the
notice saying which is missing, and pressing it SHALL send the same usage event. Going back to the
choice of the shown preview SHALL remove the notice.

#### Scenario: A layer unticked after the preview

- **WHEN** the preview is shown and the user unticks a layer
- **THEN** the earlier PDF stays with the stale notice, and no new render starts

#### Scenario: Update the preview

- **WHEN** the preview is stale and the user presses "Actualizar vista previa"
- **THEN** the preview of the current choice is rendered, and the notice goes away

#### Scenario: Nothing ticked after the preview

- **WHEN** the preview is shown and the user unticks every polygon, or every layer
- **THEN** the notice's "Actualizar vista previa" is off, and the notice says that at least one
  polygon, or one layer, is needed

#### Scenario: Back to the previewed choice

- **WHEN** the user unticks a polygon after the preview and ticks it again
- **THEN** the notice goes away, and nothing renders again

### Requirement: The download asks for the format

"Descargar" SHALL be on whenever at least one polygon and one layer are ticked, with or without a
preview, and with a stale one, except while a large report's ZIP is being built: it SHALL be off
until that job ends or is cancelled. It SHALL always download the current choice. It SHALL open a modal
titled "Formato", which depends on the report:
- **several polygons, not large:** two radio cards, "Un PDF con todo" (one file with every
  polygon) and "Un PDF por polígono" (a `.zip`), with the first one chosen. "Descargar PDF"
  downloads the chosen format.
- **one polygon:** no format choice. "Descargar PDF" downloads its PDF.
- **a large report:** only the ZIP, with the reason (see "Large reports are a ZIP with one PDF per
  farm"). Its button downloads the ZIP built farm by farm, with its progress.

Every variant SHALL also offer "Descargar GeoJSON". It downloads the ticked polygons, each with the
finding and the result of every ticked layer, as the stage 2 GeoJSON export writes them. The radio
cards SHALL be a radio group operable with the keyboard.

#### Scenario: Several polygons

- **WHEN** 8 polygons are ticked and the user presses "Descargar"
- **THEN** the "Formato" modal offers "Un PDF con todo" and "Un PDF por polígono", with
  "Descargar PDF" and "Descargar GeoJSON"

#### Scenario: One polygon

- **WHEN** only one polygon is ticked and the user presses "Descargar"
- **THEN** the modal offers "Descargar PDF" and "Descargar GeoJSON", with no format choice

#### Scenario: A large report

- **WHEN** the ticked polygons and layers make a large report and the user presses "Descargar"
- **THEN** the modal offers only the ZIP with one PDF per polygon, says why, and offers
  "Descargar GeoJSON"

#### Scenario: Download without a preview

- **WHEN** the user presses "Descargar" before generating a preview and downloads "Un PDF con todo"
- **THEN** the complete report of the current choice is rendered and saved

#### Scenario: Download with a stale preview

- **WHEN** the preview shows 5 polygons, the user unticks one and downloads the PDF
- **THEN** the downloaded PDF has 4 polygons

#### Scenario: GeoJSON of the choice

- **WHEN** 3 polygons and 1 layer are ticked and the user presses "Descargar GeoJSON"
- **THEN** a GeoJSON with those 3 polygons and that layer's finding and result is saved

## MODIFIED Requirements

### Requirement: The complete report is ready before the download click

For a report that is not large, once a requested preview has rendered, the web SHALL render the
complete report (with links) in the background, without delaying the preview. "Download" SHALL
save that blob without rendering again when it is for the current choice. If the user clicks
before the background render finishes, the download SHALL wait for that render instead of
starting another. A download of a choice that has no pre-rendered report, such as one changed
after the preview, SHALL render the complete report of the current choice then, and SHALL never
save a blob of another choice. A large report SHALL NOT be pre-rendered.

#### Scenario: Instant download

- **WHEN** the preview of the reference report has been ready for a few seconds and the user
  downloads the complete report
- **THEN** the file is saved without a new render, and it contains the document links that the
  preview hides

#### Scenario: Click before the pre-render finishes

- **WHEN** the user clicks "Download" while the background render is still running
- **THEN** the download completes when that render finishes, and only one render with links was
  made

#### Scenario: Choice changed after the preview

- **WHEN** the user changes the choice after the preview and downloads the complete report
- **THEN** the downloaded report matches the current choice, never the previewed one

#### Scenario: Large report

- **WHEN** the preview of a large report has been shown
- **THEN** no complete report is rendered in the background

### Requirement: A large report's preview shows one farm

For a large report, the requested preview SHALL show only the first selected farm's PDF, exactly as
it appears in the ZIP but without links. It SHALL come with a notice saying that the download is a
ZIP with one PDF per farm, and how many PDFs it holds. The web SHALL NOT render a complete PDF of a
large report, neither for the preview nor ahead of the download.

#### Scenario: Preview of a large report

- **WHEN** the user generates the preview of a report with 1000 farms × 5 layers
- **THEN** the preview shows the first farm's PDF within the time of one farm's render, together
  with the notice "1000 PDFs, one per farm"

#### Scenario: No complete render

- **WHEN** the preview of a large report is shown
- **THEN** no request is made to the worker for a complete PDF of the selection

### Requirement: Selecting farms for the report stays responsive

With 1000 farms in the report page's polygon list, ticking or unticking one farm, or all of them
with "Seleccionar todos", SHALL update the list and its category icons without blocking the main
thread for more than 100 ms. The list SHALL render only the rows in view (virtualized) inside a
box of bounded height that scrolls on its own. Typing in its search box SHALL stay as responsive as
today.

#### Scenario: Check one farm among 1000

- **WHEN** 1000 farms are listed and the user unticks one
- **THEN** the checkbox updates, and no main-thread task longer than 100 ms is recorded

#### Scenario: Only the rows in view

- **WHEN** 1000 farms are listed
- **THEN** fewer than 100 polygon rows are in the document, and scrolling the list shows the
  others
