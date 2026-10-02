## MODIFIED Requirements

### Requirement: One ingestion at a time with persisted job status

Ingestion SHALL run in the background, and only one job SHALL run at a time. An upload made while another job is queued or running SHALL be rejected with 409. Job state SHALL be persisted under the maps root and SHALL be retrievable through `GET /admin/jobs/{jobId}`.

The state SHALL include:
- the status (`queued`, `running`, `succeeded`, `failed`, `cancelled`);
- the phase of a running job (`validating`, then `converting`, which covers conversion, verification and activation);
- while validating, the fraction of the raster scanned so far (`progress`, from 0 to 1), updated at least every few seconds but not on every window;
- the error, the warnings, and a raster report (CRS, width, height, bounds, dtype, nodata, detected distinct values, and an approximate resolution in meters).

The error and each warning SHALL carry a stable `code`, its `params` (for example the offending values or the band count) and an English `message`, so the admin UI can show them in the user's language. On startup, jobs left `queued` or `running` SHALL be marked `failed` with the reason "interrupted by restart", and their staging files SHALL be removed.

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

- **WHEN** the API restarts while a job is running
- **THEN** after startup that job reports `failed` with "interrupted by restart" and the layer's raster is unchanged

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

## ADDED Requirements

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
