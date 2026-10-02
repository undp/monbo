## Why

Uploading a raster is the step that makes a layer usable, but today's Raster section shows it as a drop zone, a disabled button, a spinner and a technical table. The admin can't tell where they are in the process, how long is left, or what is still missing before the layer shows up in the analysis. The "Carga de raster" design turns it into a guided flow with visible steps, and ends it with publishing the layer when it isn't published yet.

## What Changes

- The Raster section of the layer editor becomes a **step flow** with an indicator that is always visible:
  1. **Select the file**
  2. **Upload and validate**
  3. **Publish the layer**, only when the layer is not published. A layer that is already published shows two steps.
- Its states follow the design:
  - no file: a drop zone with a "Select file" button;
  - file chosen: the file row with "Change file", the optional nodata field, and a single "Upload and validate" button;
  - uploading and validating: percentage, progress bar, a checklist of phases (uploading, validating pixels, converting to an optimized GeoTIFF), and "Cancel";
  - done: the raster is active, and "Publish layer" appears when the layer isn't published;
  - a failure goes back to "file chosen" with the error, so the admin can retry, set a nodata value or change the file.
- The raster is still **activated as soon as it is validated and converted**. There is no separate "Save raster" or "Discard" step.
- **Removed from the UI**:
  - the raster report table;
  - the ingestion warnings;
  - the "Publish" action inside the success message, which is replaced by step 3.

  The API keeps recording the report and the warnings in the job.
- The ingestion job reports its **phase** (`validating`, `converting`) and, while validating, its **progress**, so the checklist and the bar reflect the real work.
- **Cancel**:
  - during the upload it aborts the request;
  - during processing it calls a new **`DELETE /admin/jobs/{jobId}`**, which stops the job without touching the layer.

  A cancelled job ends with the new status `cancelled`. Once activation has begun, cancelling is refused with 409.

- **New layers start at version 0** (no raster), so the first raster uploaded is version 1 (`layer-<id>-v1.tif`) instead of 2. Seeded and migrated layers keep their versions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `raster-ingestion`:
  - jobs gain `phase` and `progress`, and a `cancelled` status;
  - a new endpoint cancels a queued or running job of the admin's country;
  - cancelling after activation has begun is refused;
  - a new layer's first raster is version 1.
- `layer-storage`: `version` may be 0, for a layer that has never had a raster.
- `admin-authentication`: CORS also allows `DELETE`, for the new cancel endpoint.
- `layer-administration`: a new layer starts at version 0, and the raster upload area of the admin UI becomes the step flow, ends with publishing when the layer isn't published, and no longer shows the report or the warnings.

## Impact

- **API (`monbo-api`)**:
  - `ingestion.py`:
    - the job records its phase and throttled validation progress;
    - `IngestionSlot` tracks cancellation and the start of activation;
    - the job checks for cancellation between windows and before activation.
  - `processing.py`: `validate_raster` and `verify_same_pixels` accept a progress and cancellation callback.
  - `rasters.py`: `DELETE /admin/jobs/{jobId}`, and `main.py` allows `DELETE` in CORS.
  - `layers.py`: new layers start at version 0.
  - Tests.
- **Frontend (`monbo-front`)**:
  - `RasterUploadSection.tsx` is rewritten as the step flow, with a step indicator component;
  - `uploadLayerRaster` accepts an `AbortSignal`, and there is a new `cancelIngestionJob`;
  - `IngestionJob` gains `phase`, `progress` and the `cancelled` status;
  - the `admin:raster` texts are rewritten in `en` and `es`;
  - `DropZone` stays in use for the public pages and is replaced in the admin by the design's drop zone. Its `hint` prop, only used by the old raster section, is removed.
- **No storage or deployment changes.**
