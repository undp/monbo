## ADDED Requirements

### Requirement: Deforestation ratio per farm and layer

For each requested layer and each farm, `POST /deforestation_analysis/analize` SHALL return the farm's deforestation ratio. The ratio is the area of the layer's loss pixels touching the farm's polygon (count × the layer's `pixel_size`²), divided by the polygon's area. It SHALL be capped at 1. It SHALL be a number between 0 and 1, or `None` when no ratio can be computed. A farm that is a point SHALL be analysed as the circle built from its declared area.

#### Scenario: Loss inside a polygon

- **WHEN** a valid polygon of 9,000 m² touches 2 loss pixels of a 30 m layer
- **THEN** its ratio for that layer is 2 × 900 / 9,000 = 0.2

#### Scenario: No loss

- **WHEN** a valid polygon touches no loss pixels
- **THEN** its ratio is 0

#### Scenario: More loss area than polygon area

- **WHEN** a polygon smaller than one pixel touches a loss pixel
- **THEN** its ratio is 1

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
