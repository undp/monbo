## Context

The Raster section of the layer editor (`RasterUploadSection.tsx`) uploads the file with an XHR that reports progress. It then polls `GET /admin/jobs/{jobId}` every 1.5 s until the job is `succeeded` or `failed`. The job runs in a background task (`run_ingestion`), one at a time across every country, guarded by the in-memory `IngestionSlot`. It validates every pixel in windows, converts to COG, verifies the COG window by window, and activates it: the new versioned filename is written to the index. The job file (`.jobs/<id>.json` on the share) only says `queued`, `running`, `succeeded` or `failed`, so the UI can't tell validation from conversion, and there is no way to stop a job.

The "Carga de raster" design (the attached HTML and its notes) defines a step indicator, five states, and colors that are close to the theme's primary. The user reviewed it and made these decisions:
- no "Save raster" or "Discard": activation stays automatic;
- step 3 is "Publish the layer", shown only when the layer isn't published;
- the report, the warnings and the current "Publish" action are removed.

## Goals / Non-Goals

**Goals:**
- A step flow that always shows where the admin is and what is left, including publishing.
- A checklist and a progress bar that follow the real phases of the job.
- A Cancel button that really stops the work and never changes the layer once pressed.

**Non-Goals:**
- Resuming an in-progress job after a page reload. The job keeps running and activates. On return, the section starts from the layer's state.
- A pending "validated but not saved" raster, which the user explicitly discarded.
- Changing validation, conversion or activation rules.
- Changing the public `DropZone` used by the Excel uploads.

## Decisions

### D1. Which steps are shown, and when the count is decided

The indicator has 3 steps when the layer is **not enabled**, and 2 when it is. The count is fixed when the section mounts and when the admin presses "Replace raster". It is not recalculated when the layer changes, so publishing in step 3 doesn't make that step vanish while the admin is looking at it.

*Alternative:* derive it on every render from `layer.enabled`. Rejected: after "Publish layer" the indicator would jump from 3 steps to 2 and hide the confirmation.

### D2. Initial state from the layer

| Layer | Initial state |
|---|---|
| no raster | **No file**, step 1 active, 3 steps (a layer without a raster can't be enabled) |
| raster, not enabled | **Ready to publish**: steps 1–2 done, step 3 active with "Publish layer", plus "Replace raster" |
| raster, enabled | **No file**, step 1 active, 2 steps (this replaces the current raster) |

The second row covers an admin who uploaded a raster and left without publishing. Without it, the section would ask for a file again even though the only thing missing is publishing.

### D3. States and transitions (frontend only)

```
none ──choose/drop .tif──▶ chosen
chosen ──Change file──▶ none
chosen ──Upload and validate──▶ processing(uploading)
processing(uploading) ──202──▶ processing(validating | converting)   (polling the job)
processing ──Cancel──▶ none
processing ──upload error / job failed──▶ chosen + error
processing ──job succeeded──▶ published? done : ready-to-publish (3 steps) | done (2 steps)
ready-to-publish ──Publish layer──▶ done
ready-to-publish, done ──Replace raster──▶ none
```

A failure keeps the chosen file, the nodata value and the error message, and shows a clear error in place of the "ready to upload" line. The admin can retry (for example after fixing the layer's pixel size in the form), set a nodata value, or change the file.

The state lives in one `useReducer`. The step indicator is a presentational `RasterSteps` component that receives each step's status (`pending`, `active` or `done`) and subtitle.

### D4. Job phase and progress

The job gains two fields:
- `phase`: `null`, then `"validating"`, then `"converting"`. Converting covers conversion, verification and activation.
- `progress`: a fraction between 0 and 1 during validation, `null` otherwise.

`validate_raster` and `verify_same_pixels` take an optional `on_window(done, total)` callback, called after each window. `run_ingestion` uses it to write the job's `progress`, **throttled** to one write every second or every 5 points of progress, whichever comes later. The job lives on the Azure Files share, and a write per window (thousands for a big raster) would slow the scan.

The UI maps them onto the design's single row:

| Phase | Label | Bar |
|---|---|---|
| uploading (XHR) | "Uploading…" | upload % |
| validating | "Validating pixels…" | job `progress` % |
| converting | "Converting…" | indeterminate, no % |

The checklist ticks a phase once the next one starts.

*Alternative:* one global percentage that weights the phases. Rejected: the weights would be guesses, and conversion has no measurable progress (it is a single GDAL call).

### D5. Cancellation

- **While uploading:** `uploadLayerRaster` accepts an `AbortSignal` and calls `xhr.abort()`. The server already deletes the partial file and frees the slot when the client disconnects.
- **While processing:** the new `DELETE /admin/jobs/{jobId}` asks the running job to stop.
  - `IngestionSlot` gains two operations, both under its lock:
    - `cancel(job_id)` returns `"cancelled"`, `"too_late"` if activation began, or `"not_running"`;
    - `begin_activation(job_id)` returns `False` when the job was cancelled, and otherwise marks activation as begun.
  - The worker checks for cancellation:
    - at the start;
    - in `on_window`, raising `IngestionCancelled`;
    - after the conversion, which can't be interrupted;
    - and through `begin_activation` just before activating.
  - Because the lock orders cancel and activation, a 202 from the endpoint guarantees the layer stays as it was.
  - A cancelled job is saved with the status `cancelled` and no error. Its staging files are deleted and the slot is released, as for any job end.
  - Responses:
    - 202 when cancellation was recorded;
    - 409 when activation already began, or the job is no longer queued or running;
    - 404 for unknown jobs and other countries' jobs, as `GET` does.

In the UI, Cancel returns to **No file** as soon as the request is accepted. On 409 because activation began, the UI keeps polling and shows the success. The layer did change, and the UI must not claim otherwise.

*Alternative:* cancel only during the upload. Rejected: validating a large raster takes minutes, and that is when an admin notices they picked the wrong file.

### D6. Visual implementation

The design's blue (`#0d64a0`) is almost the theme's primary (`#03689E`). The flow uses `theme.palette.primary` and its `alpha()` tints for the active bar, the drop zone and the success box, and the theme's `warning` tones for the amber messages. This avoids a second blue palette in the theme (the landing's green palette is there because it's a different color).

The drop zone uses `react-dropzone` (already a dependency) directly, with `noClick` and the "Select file" button calling `open()`. That gives the design's layout without changing the shared `DropZone`.

Buttons use sentence case (`textTransform: "none"`) and the radius and padding from the design, only inside this section.

### D7. What goes away

The following UI code and texts are deleted:
- `RasterReportTable` and the `admin:raster:report` texts;
- the display of warnings;
- the `publish` action inside the success message;
- the "Current raster: …" line.

The done state says which file the layer uses. The API keeps writing `report` and `warnings` to the job: they cost nothing, the ingestion tests assert them, and they help when diagnosing from the job file.

The `admin:raster:issues` texts stay, because failures still show their translated message.

## Risks / Trade-offs

- [Cancelling during conversion only takes effect when the GDAL call returns, which can take a minute for a large raster] → The UI returns to "No file" right away. An upload attempted before the worker stops gets the existing 409 "another raster is being processed" message.
- [More writes to the job file on the share] → Throttled to at most one per second, in line with the UI polling every 1.5 s.
- [The step count is fixed at mount (D1), so if another admin session of the same country publishes the layer meanwhile, step 3 can offer to publish a layer that is already published] → Enabling is idempotent, so the button just confirms it.
- [The in-memory slot assumes one API replica, as today] → No change. This is already a documented constraint of ingestion.

## Migration Plan

No data or deployment changes. The API and the front deploy together, as usual: the old front ignores the new job fields, and the new front treats a missing `phase` as validating.

## Open Questions

None.
