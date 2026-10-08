# report-generation Specification

## Purpose
How the web builds the deforestation report PDF and the API draws its images: each image is fetched once per selection and shared by the preview and both downloads, each farm's satellite background costs one Google call, the images are JPEG, the PDF renders off the main thread with local fonts, and the complete report is ready before the download click.

## Requirements
### Requirement: Report images are fetched once per selection

For a given selection of farms, maps and country, the web SHALL request each (farm, map) image from `POST /deforestation_analysis/generate-image` at most once. The preview, the complete-report download and the separated-reports download SHALL all use those images. Changing the selection SHALL fetch the images for the new selection. The web SHALL release the images it no longer uses, and every object URL created for them, both when the selection changes and when the report page unmounts.

#### Scenario: Download after preview

- **WHEN** the preview has finished loading for 10 farms × 2 maps, and the user downloads the complete report and then the separated reports
- **THEN** no further requests are made to `/generate-image`, and both files contain the same images as the preview

#### Scenario: Selection changes

- **WHEN** the user goes back, adds a map to the selection and returns to the preview
- **THEN** the images for the new selection are fetched, and the previous selection's images and object URLs are released

#### Scenario: Layer changed during download

- **WHEN** a selected layer received a new raster after the analysis, and the images are being fetched
- **THEN** the web invalidates the analysis as it does today (`MapLayerChangedError`), instead of producing a report that mixes rasters

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

`POST /deforestation_analysis/generate-image` SHALL respond with `Content-Type: image/jpeg` and a JPEG image of the same dimensions as before (500×500). The polygon or point outline and the deforestation pixels SHALL remain distinguishable from the background in the image.

#### Scenario: Content type

- **WHEN** a valid request is made to `/generate-image`
- **THEN** the response is 200 with `Content-Type: image/jpeg`, and the body decodes as a 500×500 JPEG

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

Once the preview has rendered, the web SHALL render the complete report (with links) in the background, without delaying the preview. "Download" SHALL save that blob without rendering again. If the user clicks before the background render finishes, the download SHALL wait for that render instead of starting another. A change of selection SHALL discard the pre-rendered blob.

#### Scenario: Instant download

- **WHEN** the preview of the reference report has been ready for a few seconds and the user downloads the complete report
- **THEN** the file is saved without a new render, and it contains the document links that the preview hides

#### Scenario: Click before the pre-render finishes

- **WHEN** the user clicks "Download" while the background render is still running
- **THEN** the download completes when that render finishes, and only one render with links was made

#### Scenario: Selection changed

- **WHEN** the user changes the selection and returns to the preview
- **THEN** the downloaded report matches the new selection, never the previously pre-rendered one

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
