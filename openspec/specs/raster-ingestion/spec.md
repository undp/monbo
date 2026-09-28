# Raster Ingestion

## Purpose

Define how an uploaded raster becomes a layer's raster: streamed to staging, validated as binary,
converted to a Cloud Optimized GeoTIFF, verified pixel by pixel and activated by a background job.

## Requirements

### Requirement: Raster upload streamed to staging

`PUT /admin/layers/{id}/raster` SHALL accept the raster as the raw request body and stream it in chunks to a file in a local staging directory (`ADMIN_STAGING_DIR`, default `/tmp/monbo-staging`), without holding the whole file in memory. Validation and conversion SHALL run on that local file. Only the finished, verified raster SHALL be written to the maps root. Uploads larger than `ADMIN_MAX_UPLOAD_MB` (default 500) SHALL be rejected with 413 as soon as the limit is exceeded, and the partial file SHALL be deleted. An optional `nodata` query parameter SHALL set the nodata value for rasters that don't declare one. Once the body is fully received, the endpoint SHALL respond 202 with a `jobId`.

#### Scenario: Accepted upload

- **WHEN** an admin uploads a 30 MB GeoTIFF to an existing layer
- **THEN** the response is 202 with a `jobId`, and the layer's current raster is unchanged at that moment

#### Scenario: Oversized upload

- **WHEN** an upload exceeds the configured maximum size
- **THEN** the response is 413 and no staging file remains

#### Scenario: Unknown layer

- **WHEN** an admin uploads to a layer id that does not exist
- **THEN** the response is 404

### Requirement: One ingestion at a time with persisted job status

Ingestion SHALL run in the background, and only one job SHALL run at a time. An upload made while another job is queued or running SHALL be rejected with 409. Job state SHALL be persisted under the maps root and SHALL be retrievable through `GET /admin/jobs/{jobId}`. The state SHALL include: status (`queued`, `running`, `succeeded`, `failed`), the error, the warnings, and a raster report (CRS, width, height, bounds, dtype, nodata, detected distinct values, and an approximate resolution in meters). The error and each warning SHALL carry a stable `code`, its `params` (for example the offending values or the band count) and an English `message`, so the admin UI can show them in the user's language. On startup, jobs left `queued` or `running` SHALL be marked `failed` with the reason "interrupted by restart", and their staging files SHALL be removed.

#### Scenario: Poll a running job

- **WHEN** the admin UI polls `GET /admin/jobs/{jobId}` during conversion
- **THEN** it receives `status: running`

#### Scenario: Parallel upload rejected

- **WHEN** an admin uploads a raster while another ingestion is running
- **THEN** the response is 409

#### Scenario: Restart during ingestion

- **WHEN** the API restarts while a job is running
- **THEN** after startup that job reports `failed` with "interrupted by restart" and the layer's raster is unchanged

### Requirement: Structural validation

Ingestion SHALL reject the raster when it cannot be opened as a GeoTIFF, when it has more than one band, when its dtype is not an integer type, or when it has no CRS. Each rejection SHALL have a specific error message.

#### Scenario: Multi-band raster

- **WHEN** the uploaded file has 3 bands
- **THEN** the job fails with a message stating that exactly one band is required

#### Scenario: Missing CRS

- **WHEN** the uploaded file has no CRS
- **THEN** the job fails with a message stating that a CRS is required

#### Scenario: Not a GeoTIFF

- **WHEN** the uploaded file is a PNG or a corrupt file
- **THEN** the job fails with a message stating that the file is not a readable GeoTIFF

### Requirement: Exhaustive binary validation

Ingestion SHALL read every pixel of the raster in bounded-size windows and SHALL accept it only when all values belong to {0, 1} plus the nodata value (declared in the file or given at upload). On failure, the message SHALL list up to 10 offending values. When the offending values fall within 1980–2100, the message SHALL add that they look like loss-year values that must be binarized against the baseline. A raster with no pixel equal to 1 SHALL be accepted with a warning.

#### Scenario: Binary raster accepted

- **WHEN** every pixel is 0, 1, or the nodata value
- **THEN** validation passes

#### Scenario: Stray value in a corner

- **WHEN** a raster is binary except for one pixel equal to 2 in its last row
- **THEN** the job fails and the message lists the value 2

#### Scenario: Unprocessed loss-year raster

- **WHEN** a raster contains values such as 2021, 2022, and 2023
- **THEN** the job fails with a message listing those values and saying they look like loss years that must be binarized

#### Scenario: Custom nodata

- **WHEN** a raster contains 0, 1, and 3, and the upload specifies `nodata=3`
- **THEN** validation passes and the stored raster declares nodata 3

#### Scenario: No deforestation pixels

- **WHEN** a raster contains only 0 and nodata
- **THEN** the job succeeds with a warning that no deforestation pixels were found

### Requirement: Conversion to COG with verification

After validation, ingestion SHALL convert the raster to a Cloud Optimized GeoTIFF with lossless compression and nearest-neighbour overviews, keeping the CRS and nodata. Bit-packed inputs (fewer than 8 bits per sample) SHALL be stored with 8-bit samples, without changing their values. It SHALL then verify, window by window, that the COG's pixels are identical to the validated input. If they are not, the job SHALL fail and the layer SHALL remain unchanged.

#### Scenario: Converted raster is identical and optimized

- **WHEN** a valid strip-organized, uncompressed GeoTIFF is ingested
- **THEN** the stored raster is tiled, compressed, has overviews, and its pixel values equal the input's

#### Scenario: Bit-packed raster

- **WHEN** a valid 2-bit raster (like `ecuador2.tif`) is ingested
- **THEN** the job succeeds and the stored raster has the same pixel values and nodata

#### Scenario: Verification mismatch

- **WHEN** the COG differs from the input in any pixel
- **THEN** the job fails and the layer keeps its previous raster and version

### Requirement: Atomic activation and cleanup

Only after conversion and verification succeed SHALL ingestion move the COG to its versioned filename and update the layer's `raster_filename` and `version` in a single atomic index write. Staging files SHALL be deleted when a job ends, whether it succeeds or fails.

#### Scenario: Successful ingestion

- **WHEN** a job succeeds for layer 6 at version 1
- **THEN** the layer points to `layer-6-v2.tif`, its version is 2, and no staging file remains

#### Scenario: Failed ingestion leaves no trace

- **WHEN** a job fails validation
- **THEN** the layer's `raster_filename` and `version` are unchanged and no staging file remains

