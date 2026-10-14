## MODIFIED Requirements

### Requirement: Report images are JPEG

`POST /deforestation_analysis/generate-image` SHALL respond with `Content-Type: image/jpeg` and a 640×420 JPEG image, the aspect ratio of the map box on the report's farm page. The polygon or point outline and the deforestation pixels SHALL remain distinguishable from the background in the image.

#### Scenario: Content type

- **WHEN** a valid request is made to `/generate-image`
- **THEN** the response is 200 with `Content-Type: image/jpeg`, and the body decodes as a 640×420 JPEG

#### Scenario: Version check unchanged

- **WHEN** the request's `version` is older than the layer's
- **THEN** the response is still 409, and no image is generated

## ADDED Requirements

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
