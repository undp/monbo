## 1. Job phase and progress (API)

- [x] 1.1 Give `validate_raster` and `verify_same_pixels` an optional `on_window(done, total)` callback, called after each window (total = number of windows)
- [x] 1.2 Add `phase` and `progress` to `new_job`. In `run_ingestion`, set `phase: validating` before validation and `phase: converting` (with `progress: null`) before conversion. Write the validation progress throttled to one write every second or 5 points, whichever comes later (design D4)
- [x] 1.3 Tests: a polled job reports `validating` with a growing `progress` (a raster with several windows and a small `WINDOW_SIZE`), then `converting`. The throttle writes far fewer times than there are windows

## 2. Cancellation (API)

- [x] 2.1 Extend `IngestionSlot` with `cancel(job_id)` (`cancelled`, `too_late` or `not_running`), `is_cancelled(job_id)` and `begin_activation(job_id)`, all under its lock (design D5)
- [x] 2.2 Add `IngestionCancelled`. `run_ingestion` checks for cancellation at the start, in `on_window`, after `convert_to_cog`, and through `begin_activation` right before `activate`. A cancelled job is saved as `status: cancelled` without an error, and the existing `finally` deletes the staging files and releases the slot
- [x] 2.3 Add `DELETE /admin/jobs/{jobId}`: 404 for unknown jobs and other countries' jobs, 409 when the job has ended or activation began, and 202 otherwise. Allow `DELETE` in CORS
- [x] 2.4 Tests for every scenario in `specs/raster-ingestion/spec.md`:
  - cancel during validation;
  - cancel during conversion (patch `convert_to_cog` to block until the cancel is recorded);
  - too late (activation begun, and already succeeded);
  - another country's job;
  - a new upload is accepted after a cancelled job ends.
- [x] 2.5 Run the ingestion, regression and parity suites to confirm nothing else changed

## 3. Frontend contracts

- [x] 3.1 `IngestionJob` gains `phase: "validating" | "converting" | null`, `progress: number | null`, and the `cancelled` status
- [x] 3.2 `uploadLayerRaster` accepts an `AbortSignal` (it calls `xhr.abort()` and rejects with an abort error the section can tell apart), and add `cancelIngestionJob(token, jobId)`, which reports whether it answered 202 or 409

## 4. Raster section as a step flow (frontend)

- [x] 4.1 `RasterSteps`: a presentational step indicator (bar plus circle, pending, active or done with ✓, "STEP n", title, subtitle), in theme colors (design D6)
- [x] 4.2 `RasterDropZone`, built on `useDropzone` with `noClick`: an upload icon in a white circle, "Drop your raster here", "or", a "Select file" button, the accepted-format hint, and the tinted look while dragging. It accepts `.tif` and `.tiff` only
- [x] 4.3 Rewrite `RasterUploadSection` around a `useReducer` with the states `none`, `chosen`, `processing` (uploading, validating or converting), `readyToPublish` and `done`:
  - the initial state and the step count come from the layer (design D1 and D2);
  - polling reuses today's loop;
  - a failure returns to `chosen` with the translated error;
  - Cancel aborts the XHR or calls `cancelIngestionJob`, and keeps polling on 409;
  - "Publish layer" calls `setAdminLayerEnabled` and refreshes the layer;
  - "Replace raster" goes back to `none` and recalculates the step count.
- [x] 4.4 File row (TIF badge, name, size, "ready to upload" or the phase, percentage), progress bar (determinate while uploading and validating, indeterminate while converting), and phase checklist with ✓. Buttons follow the design (sentence case, radius, padding)
- [x] 4.5 Delete `RasterReportTable`, the warnings list, the old publish action and the "Current raster" line
- [x] 4.6 Rewrite the `admin:raster` texts in `es` and `en`:
  - intro;
  - step titles and subtitles;
  - drop zone;
  - file row;
  - phases;
  - "can take a few minutes" note;
  - buttons;
  - done and ready-to-publish messages.

  Remove the `report` and `status` texts that are no longer used, and keep `issues` and `uploadErrors`
- [x] 4.7 `tsc` and `lint` pass

## 5. Verification and docs

- [x] 5.1 Check the flow in the browser against a local API, in `es` and `en`:
  - new layer: upload, then publish;
  - published layer: 2 steps;
  - invalid raster: back to "file chosen" with the error;
  - cancel while uploading and while validating;
  - unpublished layer with a raster: starts in "ready to publish".
- [x] 5.2 Update `CHANGELOG.md` and the admin section of the docs that describe the raster upload (if any)

## 6. First raster is version 1

- [x] 6.1 `POST /admin/layers` creates layers at `version: 0`, so the first upload is `layer-<id>-v1.tif`; seeded and migrated layers keep their versions
- [x] 6.2 Tests: creation returns version 0, and the first ingestion of a new layer gives `layer-6-v1.tif` at version 1
- [x] 6.3 Update `docs/maps.md` (the `version` field and the first raster's name)
