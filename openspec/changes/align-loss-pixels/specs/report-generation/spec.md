## ADDED Requirements

### Requirement: Report images draw loss pixels where they are

In each report image, the API SHALL paint the deforestation from the value of the source pixel under each image pixel's centre, resampled once, from the raster (or one of its overviews) onto the image's own grid in EPSG:3857, the satellite image's grid. A loss pixel's edges SHALL be drawn where the raster puts them, within one image pixel.

#### Scenario: A farm's image

- **WHEN** the image of a farm is generated over a raster in EPSG:4326 or in a UTM CRS
- **THEN** every image pixel shows the value of the source pixel under its centre

#### Scenario: Outside the raster

- **WHEN** the image's bounds don't overlap the raster
- **THEN** the API answers 404, as before
