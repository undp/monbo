# deforestation-analysis Specification

## Purpose
How `POST /deforestation_analysis/analize` turns a farm and a layer into a deforestation ratio, and when it returns no ratio instead of a misleading one.
## Requirements
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

### Requirement: No ratio for farms that can't be measured

The ratio SHALL be `None`, and never negative, when the farm's polygon is invalid (for example, it intersects itself or has fewer than 3 distinct vertices). It SHALL also be `None` when the polygon is empty or has no area, when the farm lies entirely outside the layer's raster, when its geometry can't be built, and when the layer's raster can't be opened. A farm that can't be measured SHALL NOT affect the other farms' results.

#### Scenario: Self-intersecting polygon touching loss pixels

- **WHEN** a "bow-tie" polygon touches 3 loss pixels
- **THEN** its ratio for that layer is `None`, and the web shows "N/A" instead of a deforestation-free chip

#### Scenario: Self-intersecting polygon touching no loss pixels

- **WHEN** a "bow-tie" polygon touches no loss pixels
- **THEN** its ratio is `None`, not `0` or `-0.0`

#### Scenario: Polygon with too few vertices

- **WHEN** a polygon farm has 1 or 2 vertices
- **THEN** its ratio is `None` for every layer, and the other farms in the request get their ratios

#### Scenario: Farm outside the raster

- **WHEN** a farm lies entirely outside a layer's raster extent
- **THEN** its ratio for that layer is `None`

#### Scenario: Area of zero

- **WHEN** the polygon's computed area is 0
- **THEN** its ratio is `None`

### Requirement: The ratio covers every part and excludes holes

For a farm with holes or several parts, the deforestation ratio SHALL be the loss area inside all its parts, outside its holes, divided by the total area of its parts minus its holes. Loss pixels inside a hole SHALL NOT count. A farm with several parts SHALL get one ratio per layer, not one per part.

#### Scenario: Loss inside a hole

- **WHEN** a farm's only loss pixels lie entirely inside its hole
- **THEN** its ratio for that layer is 0

#### Scenario: Loss in one of two parts

- **WHEN** a farm has two parts of 1 ha each, and 0.5 ha of loss lies inside one of them
- **THEN** its ratio for that layer is 0.25

#### Scenario: Part outside the raster

- **WHEN** one part of a farm lies inside a layer's raster and the other lies outside it
- **THEN** the ratio uses the loss of the part inside, over the area of both parts

