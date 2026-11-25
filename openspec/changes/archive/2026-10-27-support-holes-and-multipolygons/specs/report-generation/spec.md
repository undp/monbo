## MODIFIED Requirements

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
