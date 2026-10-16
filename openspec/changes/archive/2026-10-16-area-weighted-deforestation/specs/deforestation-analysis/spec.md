## MODIFIED Requirements

### Requirement: Deforestation ratio per farm and layer

For each requested layer and each farm, `POST /deforestation_analysis/analize` SHALL return the farm's deforestation ratio: the share of the farm polygon's area that lies on the layer's loss pixels. Each loss pixel SHALL count by the area of its intersection with the polygon, not in full. Both areas SHALL be measured in the raster's CRS. The layer's `pixel_size` SHALL NOT enter the ratio. The ratio SHALL be a number between 0 and 1, or `None` when no ratio can be computed. A farm that is a point SHALL be analysed as the circle built from its declared area.

#### Scenario: Loss inside a polygon

- **WHEN** a polygon covers 4 whole pixels of a layer, and 2 of them are loss pixels
- **THEN** its ratio for that layer is 0.5

#### Scenario: Partial coverage of a loss pixel

- **WHEN** a polygon covers 4 whole pixels with no loss, plus half of a loss pixel next to them
- **THEN** its ratio is 0.5 / 4.5 ≈ 0.111, not 1 / 4.5

#### Scenario: Loss pixel touching only the edge

- **WHEN** a polygon's edge crosses a corner of a loss pixel, so that 1% of that pixel lies inside the polygon, and no other pixel inside it is loss
- **THEN** its ratio is that sliver's area divided by the polygon's area, well under the deforestation threshold, and not the area of a whole pixel

#### Scenario: No loss

- **WHEN** a valid polygon touches no loss pixels
- **THEN** its ratio is 0

#### Scenario: Polygon smaller than a pixel, inside a loss pixel

- **WHEN** a polygon smaller than one pixel lies entirely inside a loss pixel
- **THEN** its ratio is 1

#### Scenario: Polygon smaller than a pixel, half on loss

- **WHEN** a polygon smaller than one pixel lies half on a loss pixel and half on a pixel without loss
- **THEN** its ratio is 0.5

#### Scenario: The farm reported by the user

- **WHEN** the GFW ratio of farm F0041 of the 500-farm reference upload is computed (2.73 ha, with 31 loss pixels touching it)
- **THEN** it is the share of its area on loss, about 0.667, and not 1
