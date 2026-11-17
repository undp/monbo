## MODIFIED Requirements

### Requirement: Exhaustive binary validation

Ingestion SHALL read every pixel of the raster in bounded-size windows and SHALL accept it only when all values belong to {0, 1} plus the nodata value (declared in the file or given at upload). A raster is a mask of its layer: `0` is outside the layer and `1` is inside it. Messages SHALL describe it that way and SHALL NOT assume the layer is forest loss.

Nodata SHALL NOT be 1, because 1 marks the pixels inside the layer; the error code is `nodata_is_positive`. On failure, the message SHALL list up to 10 offending values. When the layer's category is `temporal` and every offending value falls within 1980–2100, the error code SHALL be `loss_years` and the message SHALL add that they look like years that must be binarized against the layer's baseline. Otherwise the error code SHALL be `not_binary`. A layer whose category doesn't resolve SHALL be treated as not temporal. A raster with no pixel equal to 1 SHALL be accepted with the warning `no_positive_pixels`.

Seeding SHALL apply the same rules, with each seeded layer's category.

#### Scenario: Binary raster accepted

- **WHEN** every pixel is 0, 1, or the nodata value
- **THEN** validation passes

#### Scenario: Stray value in a corner

- **WHEN** a raster is binary except for one pixel equal to 2 in its last row
- **THEN** the job fails with `not_binary`, the message lists the value 2, and it describes 0 as outside the layer and 1 as inside it

#### Scenario: Unprocessed year raster in a temporal category

- **WHEN** a raster of a `deforestation` layer contains values such as 2021, 2022, and 2023
- **THEN** the job fails with `loss_years`, listing those values and saying they look like years that must be binarized against the baseline

#### Scenario: Year values in a category that is not temporal

- **WHEN** a raster of a layer whose category is not temporal (for example, protected areas) contains 2021, 2022, and 2023
- **THEN** the job fails with `not_binary`, listing those values, without mentioning years or a baseline

#### Scenario: Year values in a layer whose category doesn't resolve

- **WHEN** a raster of a layer whose `category_id` names no category of its country contains 2021, 2022, and 2023
- **THEN** the job fails with `not_binary`

#### Scenario: Custom nodata

- **WHEN** a raster contains 0, 1, and 3, and the upload specifies `nodata=3`
- **THEN** validation passes and the stored raster declares nodata 3

#### Scenario: Nodata equals the value inside the layer

- **WHEN** a raster declares nodata 1, or the upload specifies `nodata=1`
- **THEN** ingestion fails with `nodata_is_positive` and the layer keeps its previous raster

#### Scenario: No pixels inside the layer

- **WHEN** a raster of any category contains only 0 and nodata
- **THEN** the job succeeds with the warning `no_positive_pixels`, whose message says that no pixels inside the layer (value 1) were found

### Requirement: Raster resolution matches the layer pixel size

Ingestion SHALL compare the raster cell area, in square meters, with the area of the layer's `pixel_size` (`pixel_size`²). For a geographic CRS, the cell area SHALL be computed at the raster's latitudes nearest to and farthest from the equator, and both SHALL be within the tolerance. The relative area difference SHALL be at most 5%. When no single pixel size fits every latitude of the raster within 5%, ingestion SHALL reject it as spanning too many latitudes. The check SHALL run before conversion and again before activation, so an edit during conversion cannot activate a mismatched raster. Seeding SHALL apply the same check.

#### Scenario: Resolution mismatch

- **WHEN** a layer declares 30 m pixels and the uploaded raster has 10 m pixels
- **THEN** the job fails, reporting both sizes, and the layer's raster and version stay unchanged

#### Scenario: Geographic raster spanning too many latitudes

- **WHEN** an EPSG:4326 raster covers 5° N to 34° S
- **THEN** the job fails, reporting the smallest and largest pixel sizes, whatever `pixel_size` the layer declares
