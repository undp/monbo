## MODIFIED Requirements

### Requirement: Deforestation ratio per farm and layer

For each requested layer and each farm, `POST /layer_analysis/analyze` SHALL return the farm's deforestation ratio: the share of the farm polygon's area that lies on the layer's loss pixels. Each loss pixel SHALL count by the area of its intersection with the polygon, not in full. Both areas SHALL be measured in the raster's CRS. The layer's `pixel_size` SHALL NOT enter the ratio. The ratio SHALL be a number between 0 and 1, or `None` when no ratio can be computed. A farm that is a point SHALL be analysed as the circle built from its declared area.

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

#### Scenario: The validation farm on real data

- **WHEN** the GFW ratio of farm `F-VALIDACION` is computed: a rectangle whose edges run along the centres of a 5 × 4 block of GFW pixels, where 2 loss pixels lie whole inside it, 1 is cut in half by its edge and 2 are corners cut in four
- **THEN** its ratio is (2 + 0.5 + 0.25 + 0.25) / 12 = 0.25

#### Scenario: Against an independent reference

- **WHEN** random polygons are analysed on random loss rasters, in EPSG:4326 and in a UTM CRS
- **THEN** each ratio equals, within 1e-6, the area of the union of the loss pixels intersected with the polygon divided by the polygon's area, both measured in an equal-area projection

## ADDED Requirements

### Requirement: The analysis routes live under `/layer_analysis`

The analysis SHALL be served at `POST /layer_analysis/analyze`, `POST /layer_analysis/generate-image` and `GET /layer_analysis/tiles/{country}/{map_id}/dynamic/{z}/{x}/{y}.png`. The routes they replace under `/deforestation_analysis` SHALL NOT be served, not even as hidden aliases, and a request to any of them SHALL get 404.

#### Scenario: The old analysis route

- **WHEN** a client posts an analysis body to `/deforestation_analysis/analize`
- **THEN** the response is 404

#### Scenario: The old image route

- **WHEN** a client posts an image request to `/deforestation_analysis/generate-image`
- **THEN** the response is 404

#### Scenario: The old tile route

- **WHEN** a client requests `/deforestation_analysis/tiles/EC/1/dynamic/0/0/0.png`
- **THEN** the response is 404
