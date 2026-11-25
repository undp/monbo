# Raster Ingestion

## Purpose

Define how an uploaded raster becomes a layer's raster: streamed to staging, validated as binary,
converted to a Cloud Optimized GeoTIFF, verified pixel by pixel and activated by a background job,
within the country of the admin's session.
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

Ingestion SHALL run in the background, and only one job SHALL run at a time. An upload made while another job is queued or running SHALL be rejected with 409, including a job of another API process sharing the maps root (the previous revision during a deploy) that was updated within the last 15 minutes. Job state SHALL be persisted under the maps root and SHALL be retrievable through `GET /admin/jobs/{jobId}`.

The state SHALL include:
- the status (`queued`, `running`, `succeeded`, `failed`, `cancelled`);
- the phase of a running job (`validating`, then `converting`, which covers conversion, verification and activation);
- while validating, the fraction of the raster scanned so far (`progress`, from 0 to 1), updated at least every few seconds but not on every window;
- the error, the warnings, and a raster report (CRS, width, height, bounds, dtype, nodata, detected distinct values, and an approximate resolution in meters).

The error and each warning SHALL carry a stable `code`, its `params` (for example the offending values or the band count) and an English `message`, so the admin UI can show them in the user's language. On startup, jobs left `queued` or `running` and not updated for 15 minutes SHALL be marked `failed` with the reason "interrupted by restart", and staging files on the maps root older than that SHALL be removed; more recent jobs may still belong to the previous revision and SHALL be left alone. `GET /admin/jobs/{jobId}` SHALL report a queued or running job that no process has updated for 15 minutes as `failed` with the same reason. A job SHALL never move out of `failed`.

#### Scenario: Poll a running job

- **WHEN** the admin UI polls `GET /admin/jobs/{jobId}` during conversion
- **THEN** it receives `status: running` and `phase: converting`

#### Scenario: Validation progress

- **WHEN** the admin UI polls a job halfway through scanning a large raster
- **THEN** it receives `phase: validating` and a `progress` between 0 and 1 that grows between polls

#### Scenario: Parallel upload rejected

- **WHEN** an admin uploads a raster while another ingestion is running
- **THEN** the response is 409

#### Scenario: Restart during ingestion

- **WHEN** the API restarts while a job is running and no process updates it for 15 minutes
- **THEN** that job reports `failed` with "interrupted by restart" and the layer's raster is unchanged

#### Scenario: Deploy during ingestion

- **WHEN** a new revision starts while the previous one is still ingesting an upload
- **THEN** the new revision leaves that job and its staging file alone, and refuses new uploads with 409 until the job ends

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

Ingestion SHALL read every pixel of the raster in bounded-size windows and SHALL accept it only when all values belong to {0, 1} plus the nodata value (declared in the file or given at upload). Nodata SHALL NOT be 1, because 1 represents forest loss in the analysis. On failure, the message SHALL list up to 10 offending values. When the offending values fall within 1980–2100, the message SHALL add that they look like loss-year values that must be binarized against the baseline. A raster with no pixel equal to 1 SHALL be accepted with a warning.

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

#### Scenario: Nodata equals the forest-loss value

- **WHEN** a raster declares nodata 1, or the upload specifies `nodata=1`
- **THEN** ingestion fails and the layer keeps its previous raster

### Requirement: Raster resolution matches the layer pixel size

Ingestion SHALL compare the raster cell area, in square meters, with the area of the layer's `pixel_size` (`pixel_size`²). For a geographic CRS, the cell area SHALL be computed at the raster's latitudes nearest to and farthest from the equator, and both SHALL be within the tolerance. The relative area difference SHALL be at most 5%. When no single pixel size fits every latitude of the raster within 5%, ingestion SHALL reject it as spanning too many latitudes. The check SHALL run before conversion and again before activation, so an edit during conversion cannot activate a mismatched raster. Seeding SHALL apply the same check.

#### Scenario: Resolution mismatch

- **WHEN** a layer declares 30 m pixels and the uploaded raster has 10 m pixels
- **THEN** the job fails, reporting both sizes, and the layer's raster and version stay unchanged

#### Scenario: Geographic raster spanning too many latitudes

- **WHEN** an EPSG:4326 raster covers 5° N to 34° S
- **THEN** the job fails, reporting the smallest and largest pixel sizes, whatever `pixel_size` the layer declares

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

Only after conversion and verification succeed SHALL ingestion move the COG to its versioned filename and update the layer's `raster_filename` and `version` in a single atomic index write. A layer created in the admin starts at version 0, so its first raster SHALL be version 1. Staging files SHALL be deleted when a job ends, whether it succeeds, fails or is cancelled.

#### Scenario: Successful ingestion

- **WHEN** a job succeeds for layer 6 at version 1
- **THEN** the layer points to `layer-6-v2.tif`, its version is 2, and no staging file remains

#### Scenario: First raster of a new layer

- **WHEN** a job succeeds for layer 6, created in the admin and still at version 0
- **THEN** the layer points to `layer-6-v1.tif` and its version is 1

#### Scenario: Failed ingestion leaves no trace

- **WHEN** a job fails validation
- **THEN** the layer's `raster_filename` and `version` are unchanged and no staging file remains

### Requirement: Ingestion scoped to the admin's country

`PUT /admin/layers/{id}/raster` SHALL accept only layers of the country in the admin's session. Ids that belong to another country SHALL answer 404, like unknown ids. A successful ingestion SHALL store the raster in that country's `layers/rasters/` folder. Each job SHALL record its country, and `GET /admin/jobs/{jobId}` SHALL answer 404 for jobs of another country. Only one ingestion SHALL run at a time across all countries. The 409 returned while another country's job runs SHALL NOT reveal that country.

#### Scenario: Upload to another country's layer

- **WHEN** a CO admin uploads a raster to layer 3, and only EC has a layer 3
- **THEN** the response is 404 and no staging file remains

#### Scenario: Raster stored in the country folder

- **WHEN** an EC admin's upload for layer 3 (Ecuador2) at version 1 succeeds
- **THEN** the layer points to `ecuador2-v2.tif` inside `EC/layers/rasters/`

#### Scenario: Another country's job

- **WHEN** a CR admin polls a job started by a CO admin
- **THEN** the response is 404

#### Scenario: Concurrent uploads from two countries

- **WHEN** a CR admin uploads while a CO ingestion is running
- **THEN** the response is 409 with a message that another upload is in progress, without naming CO

### Requirement: Cancel an ingestion job

`DELETE /admin/jobs/{jobId}` SHALL ask a queued or running job of the admin's country to stop, and SHALL respond 202 when the cancellation is recorded. A cancellation recorded with 202 SHALL guarantee that the job does not activate its raster: the layer's `raster_filename` and `version` stay unchanged. The job SHALL stop at the latest before activation, and during validation and verification within one window. It SHALL then report `status: cancelled` without an error, delete its staging files and free the ingestion slot.

The endpoint SHALL respond:
- 409 when activation has already begun or the job has already ended;
- 404 for unknown jobs and for jobs of another country.

Cancelling an upload whose body is still being sent SHALL be done by closing the request, which already leaves nothing behind.

#### Scenario: Cancel during validation

- **WHEN** an admin cancels a job while it is validating
- **THEN** the response is 202, the job soon reports `cancelled`, no staging file remains, the layer's raster is unchanged, and a new upload is accepted

#### Scenario: Cancel during conversion

- **WHEN** an admin cancels a job while its raster is being converted
- **THEN** the response is 202, the job reports `cancelled` once the conversion returns, and the layer's raster is unchanged

#### Scenario: Too late to cancel

- **WHEN** an admin cancels a job whose activation has begun, or a job that already succeeded or failed
- **THEN** the response is 409 and the job's outcome is unchanged

#### Scenario: Another country's job

- **WHEN** an EC admin sends `DELETE /admin/jobs/{jobId}` for a CO job
- **THEN** the response is 404 and the job keeps running

