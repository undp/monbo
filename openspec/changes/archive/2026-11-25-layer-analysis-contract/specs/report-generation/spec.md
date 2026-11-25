## MODIFIED Requirements

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
