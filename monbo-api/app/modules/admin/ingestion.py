"""Raster ingestion: validate an uploaded raster, convert it to a COG and activate it.

An upload is staged on the container's local disk (`ADMIN_STAGING_DIR`), because the
exhaustive scan and the verification are I/O-bound and much slower over the Azure
Files share. Only the finished, verified COG is copied to the share, renamed to a
new versioned filename (rasters are never overwritten) and written to the index.

Only one ingestion runs at a time, across every country. Job state lives on the
share (`.jobs/` at the root, each job recording its country), so the admin UI can
poll it (status, phase and validation progress) and a restart can mark interrupted
jobs as failed. A job can be cancelled until its activation begins.

During a deploy the previous revision keeps serving (and may keep ingesting) until the
new one is ready, so two processes briefly share the share. A queued or running job is
therefore only treated as interrupted once it has gone `STALE_JOB_SECONDS` without an
update, and a new upload is refused while any other process has a job in progress.
"""

import math
import os
import re
import shutil
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from app.config import env
from app.modules.layers.processing import (
    IngestionError,
    check_pixel_size,
    convert_to_cog,
    issue,
    set_nodata,
    validate_raster,
    verify_same_pixels,
)
from app.modules.layers.store import LayersRoot, LayerStore, get_layers_root

from .auth import logger

# --- One ingestion at a time -------------------------------------------------------


class IngestionSlot:
    """The job being ingested, and whether it was cancelled or began activating.

    The lock orders `cancel` and `begin_activation`: once a cancellation is
    accepted, the job cannot activate, and once activation began, it cannot be
    cancelled.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.job_id: str | None = None
        self._cancelled = False
        self._activating = False

    def acquire(self, job_id: str) -> bool:
        with self._lock:
            if self.job_id is not None:
                return False
            self.job_id = job_id
            self._cancelled = self._activating = False
            return True

    def release(self, job_id: str) -> None:
        with self._lock:
            if self.job_id == job_id:
                self.job_id = None
                self._cancelled = self._activating = False

    def cancel(self, job_id: str) -> str:
        """`cancelled`, `too_late` (activation began) or `not_running`."""
        with self._lock:
            if self.job_id != job_id:
                return "not_running"
            if self._activating:
                return "too_late"
            self._cancelled = True
            return "cancelled"

    def is_cancelled(self, job_id: str) -> bool:
        with self._lock:
            return self.job_id == job_id and self._cancelled

    def begin_activation(self, job_id: str) -> bool:
        """False when the job was cancelled: it must not activate."""
        with self._lock:
            if self.job_id != job_id or self._cancelled:
                return False
            self._activating = True
            return True


ingestion_slot = IngestionSlot()


# --- Jobs --------------------------------------------------------------------------

# Longer than any gap between two updates of a running job (its slowest step, the
# exhaustive scan of a large upload, takes a few minutes).
STALE_JOB_SECONDS = 15 * 60
IN_PROGRESS = ("queued", "running")


def _now() -> str:
    return (
        datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


def new_job(job_id: str, country: str, layer_id: int, nodata: float | None) -> dict:
    now = _now()
    return {
        "jobId": job_id,
        "country": country,
        "layerId": layer_id,
        "status": "queued",
        # While running: "validating", then "converting" (conversion, verification
        # and activation). `progress` is the fraction scanned while validating.
        "phase": None,
        "progress": None,
        "createdAt": now,
        "updatedAt": now,
        "requestedNodata": nodata,
        "error": None,
        "warnings": [],
        "report": None,
        "rasterFilename": None,
        "version": None,
    }


def _age_seconds(timestamp: object) -> float:
    try:
        moment = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
    except ValueError:
        return math.inf
    return (datetime.now(timezone.utc) - moment).total_seconds()


def is_in_progress(job: dict) -> bool:
    """Queued or running, and updated recently enough that its process may be alive."""
    return (
        job.get("status") in IN_PROGRESS
        and _age_seconds(job.get("updatedAt")) < STALE_JOB_SECONDS
    )


def _save(store: LayerStore, job: dict, **changes) -> None:
    if changes.get("status", job.get("status")) != "failed":
        # Never bring a job back from `failed`: another process may have marked it
        # interrupted, and the admin UI has stopped waiting for it.
        stored = store.read_job(job["jobId"])
        if stored is not None and stored.get("status") == "failed":
            raise IngestionError("interrupted", "Interrupted by restart")
    job.update(changes, updatedAt=_now())
    store.write_job(job)


def _mark_interrupted(store: LayerStore, job: dict) -> None:
    _save(
        store,
        job,
        status="failed",
        phase=None,
        progress=None,
        error=issue("interrupted", "Interrupted by restart"),
    )
    logger.warning("Ingestion job %s was interrupted by a restart", job["jobId"])


def recover_interrupted_jobs(root: LayersRoot) -> None:
    """At startup: fail jobs whose process is gone, and clean their staging files.

    A recently updated job may belong to the previous revision, which keeps running
    during a deploy: it is left alone (`refresh_job` fails it later if it goes stale).
    """
    store = root.flat  # jobs and the share's staging area live at the root
    for job in store.list_jobs():
        if job.get("status") in IN_PROGRESS and not is_in_progress(job):
            _mark_interrupted(store, job)
    local = Path(env.ADMIN_STAGING_DIR)  # this container's disk: nobody else's files
    if local.is_dir():
        for path in local.iterdir():
            if path.is_file():
                path.unlink(missing_ok=True)
    if store.staging_dir.is_dir():  # on the share: may be a live activation's COG
        for path in store.staging_dir.iterdir():
            if path.is_file() and time.time() - path.stat().st_mtime > (
                STALE_JOB_SECONDS
            ):
                path.unlink(missing_ok=True)


def refresh_job(store: LayerStore, job: dict) -> dict:
    """The job as the admin should see it: a queued/running job that no process has
    updated for `STALE_JOB_SECONDS` was interrupted, and is saved as failed."""
    if (
        job.get("status") in IN_PROGRESS
        and not is_in_progress(job)
        and ingestion_slot.job_id != job.get("jobId")
    ):
        _mark_interrupted(store, job)
    return job


def ingestion_in_progress(store: LayerStore) -> bool:
    """Whether any process (this one or a previous revision) is ingesting."""
    return ingestion_slot.job_id is not None or any(
        is_in_progress(job) for job in store.list_jobs()
    )


# --- Activation --------------------------------------------------------------------


def _raster_stem(entry: dict) -> str:
    filename = entry.get("raster_filename")
    if not filename:
        return f"layer-{entry['id']}"
    return re.sub(r"-v\d+$", "", Path(filename).stem)


def activate(
    root: LayersRoot,
    store: LayerStore,
    layer_id: int,
    cog: Path,
    job_id: str,
    pixel_size: tuple[float, float] | None,
) -> dict:
    """Copy the COG to the share, give it a new versioned name in the country's
    folder (`store`) and point the layer at it. Returns the updated index entry."""
    share_staging = root.flat.staging_dir / f"{job_id}.tif"
    share_staging.parent.mkdir(parents=True, exist_ok=True)
    # Outside the lock: copying to the share takes seconds.
    shutil.copyfile(cog, share_staging)
    try:
        with store.locked():
            index = store.read_index()
            entry = next((e for e in index or [] if e["id"] == layer_id), None)
            if index is None or entry is None:
                raise IngestionError("layer_not_found", "The layer no longer exists")
            # An admin may have edited pixel_size while the COG was converting.
            check_pixel_size(entry["pixel_size"], pixel_size)
            version = entry["version"] + 1
            stem = _raster_stem(entry)
            while store.raster_path(f"{stem}-v{version}.tif").exists():
                version += 1
            target = store.raster_path(f"{stem}-v{version}.tif")
            target.parent.mkdir(parents=True, exist_ok=True)
            # A new name, never an existing file: safe on SMB.
            os.replace(share_staging, target)
            entry["raster_filename"] = target.name
            entry["version"] = version
            store.write_index(index)
            return entry
    finally:
        share_staging.unlink(missing_ok=True)


# --- The job ---------------------------------------------------------------------

# The job file is on the share: write the validation progress at most this often.
PROGRESS_INTERVAL_S = 1.0
PROGRESS_STEP = 0.05


class IngestionCancelled(Exception):
    pass


def _stop_if_cancelled(job_id: str) -> None:
    if ingestion_slot.is_cancelled(job_id):
        raise IngestionCancelled


class _ValidationProgress:
    """`on_window` for the validation: stops a cancelled job, and records the
    progress once both PROGRESS_INTERVAL_S and PROGRESS_STEP have passed."""

    def __init__(self, store: LayerStore, job: dict) -> None:
        self.store = store
        self.job = job
        self.written = 0.0
        self.written_at = time.monotonic()

    def __call__(self, done: int, total: int) -> None:
        _stop_if_cancelled(self.job["jobId"])
        progress = done / total
        now = time.monotonic()
        if (
            now - self.written_at >= PROGRESS_INTERVAL_S
            and progress - self.written >= PROGRESS_STEP
        ):
            _save(self.store, self.job, progress=round(progress, 3))
            self.written, self.written_at = progress, now


def run_ingestion(
    job_id: str,
    country: str,
    layer_id: int,
    staged: Path,
    requested_nodata: float | None,
) -> None:
    """Background task: validate, convert, verify and activate one upload, unless
    it is cancelled first."""
    root = get_layers_root()
    store = root.flat  # jobs live at the root
    country_store = root.country_store(country)
    job = store.read_job(job_id) or new_job(job_id, country, layer_id, requested_nodata)
    cog = staged.with_name(f"{job_id}.cog.tif")
    try:
        _stop_if_cancelled(job_id)
        _save(store, job, status="running", phase="validating", progress=0)
        validation = validate_raster(
            staged, requested_nodata, on_window=_ValidationProgress(store, job)
        )
        _save(
            store,
            job,
            report=validation.report,
            warnings=validation.warnings,
            phase="converting",
            progress=None,
        )
        index = country_store.read_index()
        entry = next((e for e in index or [] if e["id"] == layer_id), None)
        if entry is None:
            raise IngestionError("layer_not_found", "The layer no longer exists")
        pixel_size = validation.pixel_size_range_m
        check_pixel_size(entry["pixel_size"], pixel_size)
        if validation.nodata is not None and validation.needs_nodata:
            set_nodata(staged, validation.nodata)
        convert_to_cog(staged, cog)
        _stop_if_cancelled(job_id)  # the conversion itself can't be interrupted
        verify_same_pixels(staged, cog, on_window=lambda *_: _stop_if_cancelled(job_id))
        if not ingestion_slot.begin_activation(job_id):
            raise IngestionCancelled
        entry = activate(root, country_store, layer_id, cog, job_id, pixel_size)
        _save(
            store,
            job,
            status="succeeded",
            phase=None,
            rasterFilename=entry["raster_filename"],
            version=entry["version"],
        )
        logger.info(
            "Admin ingested %s for layer %s", entry["raster_filename"], layer_id
        )
    except IngestionCancelled:
        logger.info("Ingestion job %s for layer %s was cancelled", job_id, layer_id)
        _save_end(store, job, status="cancelled")
    except IngestionError as e:
        logger.warning("Ingestion job %s for layer %s failed: %s", job_id, layer_id, e)
        _save_failure(store, job, e.as_issue())
    except Exception:
        logger.exception("Ingestion job %s for layer %s crashed", job_id, layer_id)
        _save_failure(
            store,
            job,
            issue("unexpected", "Unexpected error while processing the raster"),
        )
    finally:
        staged.unlink(missing_ok=True)
        cog.unlink(missing_ok=True)
        ingestion_slot.release(job_id)


def _save_failure(store: LayerStore, job: dict, error: dict) -> None:
    _save_end(store, job, status="failed", error=error)


def _save_end(store: LayerStore, job: dict, **changes) -> None:
    try:
        _save(store, job, phase=None, progress=None, **changes)
    except Exception:
        logger.exception("Could not record the end of job %s", job["jobId"])
