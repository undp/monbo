# report-generation Specification

## Purpose
How the web builds the deforestation report PDF and the API draws its images: each image is fetched once per selection and shared by the preview and both downloads, each farm's satellite background costs one Google call, the images are JPEG, the PDF renders off the main thread with local fonts, and the complete report is ready before the download click. A large report (more than 1000 farm pages) is delivered as a ZIP with one PDF per farm, built farm by farm with its progress shown.
## Requirements
### Requirement: Report images are fetched once per selection

For a given selection of farms, maps and country whose report is not large, the web SHALL request each (farm, map) image from `POST /deforestation_analysis/generate-image` at most once. The preview, the complete-report download and the separated-reports download SHALL all use those images. For a large report, the images SHALL be fetched farm by farm while its ZIP is built, and released as each farm is done (see "A large report's ZIP is built farm by farm"); the one-farm preview SHALL fetch only that farm's images. Changing the selection SHALL fetch the images for the new selection. The web SHALL release the images it no longer uses, and every object URL created for them, both when the selection changes and when the report page unmounts.

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

The web SHALL decide whether to include the satellite background by comparing the number of distinct farms that have images against `MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION`, not the number of (farm, map) pairs. When the limit is unset, the background SHALL always be included.

#### Scenario: Under the limit by farms

- **WHEN** the limit is 100 and the report has 60 farms × 3 maps (180 images)
- **THEN** every image includes the satellite background

#### Scenario: Over the limit

- **WHEN** the limit is 100 and the report has 120 farms
- **THEN** every image uses the solid background, as today

### Requirement: Report images are JPEG

`POST /deforestation_analysis/generate-image` SHALL respond with `Content-Type: image/jpeg` and a 640×420 JPEG image, the aspect ratio of the map box on the report's farm page. The polygon or point outline and the deforestation pixels SHALL remain distinguishable from the background in the image.

#### Scenario: Content type

- **WHEN** a valid request is made to `/generate-image`
- **THEN** the response is 200 with `Content-Type: image/jpeg`, and the body decodes as a 640×420 JPEG

#### Scenario: Version check unchanged

- **WHEN** the request's `version` is older than the layer's
- **THEN** the response is still 409, and no image is generated

### Requirement: Report images use the raster currently on disk

The API MAY keep rasters open between requests, but an image SHALL always be drawn from the file currently at the layer's raster path. When that file is replaced while the API runs (for example, when the layers share is seeded again), the next image SHALL be drawn from the new file, as `/analize` does.

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

For a report that is not large, once the preview has rendered, the web SHALL render the complete report (with links) in the background, without delaying the preview. "Download" SHALL save that blob without rendering again. If the user clicks before the background render finishes, the download SHALL wait for that render instead of starting another. A change of selection SHALL discard the pre-rendered blob. A large report SHALL NOT be pre-rendered.

#### Scenario: Instant download

- **WHEN** the preview of the reference report has been ready for a few seconds and the user downloads the complete report
- **THEN** the file is saved without a new render, and it contains the document links that the preview hides

#### Scenario: Click before the pre-render finishes

- **WHEN** the user clicks "Download" while the background render is still running
- **THEN** the download completes when that render finishes, and only one render with links was made

#### Scenario: Selection changed

- **WHEN** the user changes the selection and returns to the preview
- **THEN** the downloaded report matches the new selection, never the previously pre-rendered one

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

In each report image, the API SHALL draw the farm (its polygon or point, fill and outline) above the deforestation pixels, which SHALL be drawn above the satellite image or the solid background. Where deforestation crosses the farm's edge, the outline SHALL remain visible.

#### Scenario: Loss crossing the farm's edge

- **WHEN** an image is generated for a polygon whose edge crosses deforestation pixels
- **THEN** the pixels on the polygon's outline have the outline's yellow, not the deforestation's red

#### Scenario: Point farm

- **WHEN** an image is generated for a point farm over deforestation pixels
- **THEN** the point's circle outline is visible over the red

### Requirement: The whole farm is visible in the report

Each report image SHALL contain the whole farm with its padding, whatever the farm's shape, and the report PDF SHALL show the whole image without cropping it.

#### Scenario: Tall, narrow farm

- **WHEN** an image is generated for a polygon whose north–south extent is several times its east–west extent
- **THEN** every vertex of the polygon falls inside the image, at least the padding away from the top and bottom edges

#### Scenario: Wide farm

- **WHEN** an image is generated for a polygon whose east–west extent is several times its north–south extent
- **THEN** every vertex of the polygon falls inside the image, at least the padding away from the left and right edges

#### Scenario: Image in the PDF

- **WHEN** the report is rendered with a farm's image
- **THEN** the map box on the farm page has the image's aspect ratio, and the image is shown entirely (not cropped)

### Requirement: Large reports are a ZIP with one PDF per farm

A report SHALL be large when its farm pages exceed 1000. Its farm pages are the selected (farm, layer) pairs that have a result, which is one page each in the complete PDF. A large report SHALL be downloadable only as a ZIP with one PDF per farm: the web SHALL NOT offer the single complete PDF for it, and SHALL say why. A report of 1000 farm pages or fewer SHALL keep offering both downloads.

#### Scenario: Large report download

- **WHEN** the user generates the report for 1000 farms × 4 layers (about 4000 farm pages)
- **THEN** the only download offered is the ZIP with one PDF per farm, and the page explains that large reports are delivered that way

#### Scenario: Small report download

- **WHEN** the user generates the report for 200 farms × 4 layers (800 farm pages)
- **THEN** both the complete PDF and the ZIP are offered, as before

#### Scenario: Pages count only farms with a result

- **WHEN** 300 farms × 4 layers are selected, and 60 of those (farm, layer) pairs have no result
- **THEN** the report has 1140 farm pages, and it is large

### Requirement: A large report's preview shows one farm

For a large report, the preview SHALL show only the first selected farm's PDF, exactly as it appears in the ZIP but without links. It SHALL come with a notice saying that the download is a ZIP with one PDF per farm, and how many PDFs it holds. The web SHALL NOT render a complete PDF of a large report, neither for the preview nor ahead of the download.

#### Scenario: Preview of a large report

- **WHEN** the user opens the preview of a report with 1000 farms × 5 layers
- **THEN** the preview shows the first farm's PDF within the time of one farm's render, together with the notice "1000 PDFs, one per farm"

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

With 1000 farms on the report's selection table, checking or unchecking one farm, or all of them, SHALL update the table without blocking the main thread for more than 100 ms. Typing in its search box SHALL stay as responsive as today.

#### Scenario: Check one farm among 1000

- **WHEN** 1000 farms are listed and the user unchecks one
- **THEN** the checkbox updates, and no main-thread task longer than 100 ms is recorded

