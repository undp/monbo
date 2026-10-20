## ADDED Requirements

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

## MODIFIED Requirements

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
