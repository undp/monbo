# report-generation Specification

## Purpose
How the web builds the deforestation report PDF and the API draws its images: each image is fetched once per selection and shared by the preview and both downloads, each farm's satellite background costs one Google call, the images are JPEG, the PDF renders off the main thread with local fonts, and the complete report is ready before the download click. A large report (more than 1000 farm pages) is delivered as a ZIP with one PDF per farm, built farm by farm with its progress shown.
## Requirements
### Requirement: Report images are fetched once per selection

For a given selection of farms, maps and country whose report is not large, the web SHALL request each (farm, map) image from `POST /layer_analysis/generate-image` at most once. The preview, the complete-report download and the separated-reports download SHALL all use those images. For a large report, the images SHALL be fetched farm by farm while its ZIP is built, and released as each farm is done (see "A large report's ZIP is built farm by farm"); the one-farm preview SHALL fetch only that farm's images. Changing the selection SHALL fetch the images for the new selection. The web SHALL release the images it no longer uses, and every object URL created for them, both when the selection changes and when the report page unmounts.

#### Scenario: Download after preview

- **WHEN** the preview has finished loading for 10 farms × 2 maps, and the user downloads the complete report and then the separated reports
- **THEN** no further requests are made to `/generate-image`, and both files contain the same images as the preview

#### Scenario: Selection changes

- **WHEN** the user goes back, adds a map to the selection and returns to the preview
- **THEN** the images for the new selection are fetched, and the previous selection's images and object URLs are released

#### Scenario: Layer changed during download

- **WHEN** a selected layer received a new raster after the analysis, and the images are being fetched
- **THEN** the web invalidates the analysis as it does today (`MapLayerChangedError`), instead of producing a report that mixes rasters

#### Scenario: Large report holds no image set

- **WHEN** the preview of a large report has been shown
- **THEN** only the first farm's images have been fetched, and none of the other farms' images are held in memory

### Requirement: One satellite background per farm

When `/generate-image` is called with `include_satelital_background=true` for the same geometry and different maps, the API SHALL fetch the satellite image from Google Static Maps once and reuse it for every map. This SHALL hold even when the requests arrive concurrently. The cache SHALL be bounded in size, and an entry SHALL be reused only for the same center, zoom and output size.

#### Scenario: Same farm, three maps

- **WHEN** the web requests images for 1 farm × 3 maps with the satellite background
- **THEN** the API makes exactly 1 request to Google Static Maps

#### Scenario: Concurrent requests

- **WHEN** 3 requests for the same farm and different maps arrive at the same time, before any satellite image is cached
- **THEN** the API makes exactly 1 request to Google Static Maps, and all 3 responses include the background

#### Scenario: A report larger than the cache

- **WHEN** the web requests images for 300 farms × 3 maps with the satellite background, more farms than the cache holds
- **THEN** the API still makes one request to Google Static Maps per farm

#### Scenario: Failed fetch is not cached

- **WHEN** Google Static Maps fails for a farm
- **THEN** that request fails as it does today, and a later request for the same farm tries Google again

### Requirement: The satellite limit counts farms

The web SHALL decide whether to include the satellite background by comparing the number of distinct farms that have images against `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION`, not the number of (farm, map) pairs. When the limit is unset, the background SHALL always be included. When the report is above the limit, its preview SHALL say so, with the limit, in the user's language.

#### Scenario: Under the limit by farms

- **WHEN** the limit is 100 and the report has 60 farms × 3 maps (180 images)
- **THEN** every image includes the satellite background

#### Scenario: Over the limit

- **WHEN** the limit is 100 and the report has 120 farms
- **THEN** every image uses the solid background, as today
- **AND** the preview shows "This report has more than 100 farms: the maps are generated without the satellite background image."

### Requirement: Report images are JPEG

`POST /layer_analysis/generate-image` SHALL respond with `Content-Type: image/jpeg` and a 640×420 JPEG image, the aspect ratio of the map box on the report's farm page. The polygon or point outline and the deforestation pixels SHALL remain distinguishable from the background in the image.

#### Scenario: Content type

- **WHEN** a valid request is made to `/generate-image`
- **THEN** the response is 200 with `Content-Type: image/jpeg`, and the body decodes as a 640×420 JPEG

#### Scenario: Version check unchanged

- **WHEN** the request's `version` is older than the layer's
- **THEN** the response is still 409, and no image is generated

### Requirement: Report images use the raster currently on disk

The API MAY keep rasters open between requests, but an image SHALL always be drawn from the file currently at the layer's raster path. When that file is replaced while the API runs (for example, when the layers share is seeded again), the next image SHALL be drawn from the new file, as `/layer_analysis/analyze` does.

#### Scenario: Raster replaced at the same path

- **WHEN** an image was generated for a layer, and then the file at its raster path is replaced with a different raster
- **THEN** the next image for that layer is drawn from the new raster

### Requirement: Image generation does not block the API

While images are being generated, the API SHALL keep serving other requests: CPU-bound image work (overlay drawing, compositing, encoding) and raster I/O SHALL run outside the event loop.

#### Scenario: Liveness during a report

- **WHEN** a report with 200 images is being generated
- **THEN** `GET /health/live` keeps responding without waiting for the image requests to finish

### Requirement: Rendering the PDF does not freeze the page

The web SHALL render the report PDF (the preview, the complete download and each separated report) off the main thread. While a PDF renders, the page SHALL stay responsive: the progress indicator animates and the navigation works.

#### Scenario: Large report

- **WHEN** the user opens the preview of a report with 100 farms × 3 maps
- **THEN** the loading indicator keeps animating, and the user can navigate back while the PDF is rendering

#### Scenario: Same content

- **WHEN** a report is downloaded
- **THEN** it has the same pages, texts (in the selected language), numbers and links as a report rendered on the main thread

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

### Requirement: A failed preview can be retried

When the preview can't be generated (the images can't be fetched, or the render fails), the web SHALL stop the loading indicator and show an error in the user's language with a way to retry. Retrying SHALL fetch or render again for the same selection. A layer that changed after the analysis SHALL still invalidate the analysis instead (`MapLayerChangedError`).

#### Scenario: Preview fails

- **WHEN** fetching the report's images fails
- **THEN** the preview shows an error with a "Retry" button instead of a spinner that never ends

#### Scenario: Retry

- **WHEN** the user clicks "Retry" and the API answers this time
- **THEN** the preview is generated for the same selection

### Requirement: No third-party requests to render the PDF

Rendering the PDF SHALL NOT request resources from third-party hosts. The fonts and images embedded in the report SHALL be served by the web itself.

#### Scenario: Fonts are local

- **WHEN** a report is generated
- **THEN** no request is made to `fonts.gstatic.com` or any other third-party host, and the PDF uses Roboto

### Requirement: The report renders every text style it uses

The report SHALL have a font face for every weight and style its texts use, including the italic and bold italic of the layers' considerations (markdown `_italic_` and `**_bold italic_**`).

#### Scenario: Considerations with italics

- **WHEN** the report includes a layer whose considerations contain `_italic_` text (like Colombia's IDEAM)
- **THEN** the PDF is generated, and that text is set in Roboto Italic

#### Scenario: Bold italic

- **WHEN** a layer's considerations contain `**_bold italic_**` text
- **THEN** the PDF is generated, and that text is set in Roboto Bold Italic

### Requirement: The farm is drawn above the deforestation

In each report image, the API SHALL draw the farm (its polygon or point, fill and outline) above the deforestation pixels, which SHALL be drawn above the satellite image or the solid background. Where deforestation crosses the farm's edge, the outline SHALL remain visible. A farm's holes SHALL be drawn as empty areas with the same outline as the exterior, and every part of the farm SHALL be drawn.

#### Scenario: Loss crossing the farm's edge

- **WHEN** an image is generated for a polygon whose edge crosses deforestation pixels
- **THEN** the pixels on the polygon's outline have the outline's yellow, not the deforestation's red

#### Scenario: Point farm

- **WHEN** an image is generated for a point farm over deforestation pixels
- **THEN** the point's circle outline is visible over the red

#### Scenario: Farm with a hole

- **WHEN** an image is generated for a farm with a hole
- **THEN** the hole's outline is drawn in the outline's yellow, and the hole is not filled

### Requirement: The whole farm is visible in the report

Each report image SHALL contain the whole farm with its padding, whatever the farm's shape, and the report PDF SHALL show the whole image without cropping it. A farm with several parts SHALL get one image that contains all of its parts, even when they are far apart and look small in it.

#### Scenario: Tall, narrow farm

- **WHEN** an image is generated for a polygon whose north–south extent is several times its east–west extent
- **THEN** every vertex of the polygon falls inside the image, at least the padding away from the top and bottom edges

#### Scenario: Wide farm

- **WHEN** an image is generated for a polygon whose east–west extent is several times its north–south extent
- **THEN** every vertex of the polygon falls inside the image, at least the padding away from the left and right edges

#### Scenario: Image in the PDF

- **WHEN** the report is rendered with a farm's image
- **THEN** the map box on the farm page has the image's aspect ratio, and the image is shown entirely (not cropped)

#### Scenario: Farm with two parts far apart

- **WHEN** an image is generated for a farm whose two parts are 5 km apart
- **THEN** one image is generated, and every vertex of both parts falls inside it, at least the padding away from its edges

### Requirement: Large reports are a ZIP with one PDF per farm

A report SHALL be large when its farm pages exceed 1000. Its farm pages are the pages the complete PDF has about its farms: one sheet per selected farm, also when none of its results could be computed, plus one map page per selected (farm, layer) pair that has a result. A large report SHALL be downloadable only as a ZIP with one PDF per farm: the web SHALL NOT offer the single complete PDF for it, and SHALL say why. A report of 1000 farm pages or fewer SHALL keep offering both downloads.

#### Scenario: Large report download

- **WHEN** the user generates the report for 1000 farms × 4 layers (about 5000 farm pages)
- **THEN** the only download offered is the ZIP with one PDF per farm, and the page explains that large reports are delivered that way

#### Scenario: Small report download

- **WHEN** the user generates the report for 200 farms × 4 layers (1000 farm pages: 200 sheets and 800 maps)
- **THEN** both the complete PDF and the ZIP are offered

#### Scenario: Pages count only farms with a result

- **WHEN** 300 farms × 4 layers are selected, and 60 of those (farm, layer) pairs have no result
- **THEN** the report has 1440 farm pages (300 sheets and 1140 maps), and it is large

#### Scenario: Farms without results still have their sheet

- **WHEN** 2600 farms × 1 layer are selected and only 1000 of them have a result
- **THEN** the report has 3600 farm pages (2600 sheets and 1000 maps), and it is large

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

### Requirement: A large report's ZIP is built farm by farm

The web SHALL build a large report's ZIP one farm at a time: fetch that farm's images, render its PDF off the main thread, add it to the ZIP, and release that farm's images and object URLs before moving on. It MAY fetch the images of a bounded number of upcoming farms ahead, but the images held in memory SHALL NOT grow with the number of farms. While the ZIP is built, the page SHALL show progress as farms done out of the total, and SHALL stay responsive. Leaving the page or changing the selection SHALL cancel the job. A transient failure of one image request SHALL be retried before the job fails. A layer that changed after the analysis SHALL still invalidate the analysis (`MapLayerChangedError`).

#### Scenario: 1000 farms × 5 layers

- **WHEN** the user downloads the ZIP of a report with 1000 farms × 5 layers
- **THEN** the ZIP is saved with 1000 PDFs, the tab doesn't crash, and the progress went from 0 to 1000

#### Scenario: Progress

- **WHEN** the ZIP of a large report is being built
- **THEN** a card centered on the page shows the percentage and "N of M farms", with N increasing as each farm's PDF is added, and a "Cancel" button
- **AND** the user can still scroll and navigate

#### Scenario: Leaving cancels

- **WHEN** the user leaves the report page while the ZIP is being built
- **THEN** no more image requests are made for that job, and the worker stops

#### Scenario: Transient image failure

- **WHEN** one `/generate-image` request fails once with a network error or a 5xx response during the job
- **THEN** that request is retried, and the ZIP completes

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

### Requirement: Report images draw loss pixels where they are

In each report image, the API SHALL paint the deforestation from the value of the source pixel under each image pixel's centre, resampled once, from the raster (or one of its overviews) onto the image's own grid in EPSG:3857, the satellite image's grid. A loss pixel's edges SHALL be drawn where the raster puts them, within one image pixel.

#### Scenario: A farm's image

- **WHEN** the image of a farm is generated over a raster in EPSG:4326 or in a UTM CRS
- **THEN** every image pixel shows the value of the source pixel under its centre

#### Scenario: Outside the raster

- **WHEN** the image's bounds don't overlap the raster
- **THEN** the API answers 404, as before

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

### Requirement: The report's layer texts follow the UI language

The layers of the report's choice SHALL carry the texts of the current UI language: when the
analysed layers are refreshed for a new language, the report's chosen layers SHALL be replaced by
the refreshed layers with the same id, keeping the user's choice. A preview or a complete report
SHALL be reused only for the same layer texts: a PDF rendered with other texts SHALL NOT be
downloaded. A change of texts alone SHALL NOT fetch the report's images again.

#### Scenario: PDF after a language change

- **WHEN** the report's layers were chosen in Spanish, the user switches to English and downloads
  the report
- **THEN** the layer names, attributes and considerations in the PDF are the English texts, and no
  Spanish layer text appears

#### Scenario: Texts arrive after the preview was asked for

- **WHEN** the user asks for the preview right after switching the language, before the layer list
  of the new language arrived, and the list then arrives
- **THEN** the shown preview is marked as not matching the current choice, the download renders
  with the new texts, and no image is fetched again

### Requirement: Report downloads are named for Monbo

The complete report SHALL be saved as `monbo-report.pdf`. The separated reports and a large
report's ZIP SHALL be saved as `monbo-reports.zip`. The names SHALL be the same in every UI
language, and SHALL NOT name a single layer category.

#### Scenario: Complete report

- **WHEN** the user downloads "Un PDF con todo"
- **THEN** the file is saved as `monbo-report.pdf`

#### Scenario: Separated reports

- **WHEN** the user downloads "Un PDF por polígono"
- **THEN** the file is saved as `monbo-reports.zip`

#### Scenario: Large report

- **WHEN** the user downloads a large report's ZIP built farm by farm
- **THEN** the file is saved as `monbo-reports.zip`

#### Scenario: English UI

- **WHEN** the UI is in English and the user downloads the complete report
- **THEN** the file is saved as `monbo-report.pdf`

