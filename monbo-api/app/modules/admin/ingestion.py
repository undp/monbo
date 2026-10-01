"""Raster ingestion: validate an uploaded raster, convert it to a COG and activate it.

An upload is staged on the container's local disk (`ADMIN_STAGING_DIR`), because the
exhaustive scan and the verification are I/O-bound and much slower over the Azure
Files share. Only the finished, verified COG is copied to the share, renamed to a
new versioned filename (rasters are never overwritten) and written to the index.

Only one ingestion runs at a time, across every country. Job state lives on the
share (`.jobs/` at the root, each job recording its country), so the admin UI can
poll it (status, phase and validation progress) and a restart can mark interrupted
jobs as failed. A job can be cancelled until its activation begins.
"""

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


def _save(store: LayerStore, job: dict, **changes) -> None:
    job.update(changes, updatedAt=_now())
    store.write_job(job)


def recover_interrupted_jobs(root: LayersRoot) -> None:
    """At startup: jobs left queued/running died with the previous process."""
    store = root.flat
    for job in store.list_jobs():
        if job.get("status") in ("queued", "running"):
            _save(
                store,
                job,
                status="failed",
                phase=None,
                progress=None,
                error=issue("interrupted", "Interrupted by restart"),
            )
            logger.warning(
                "Ingestion job %s was interrupted by a restart", job["jobId"]
            )
    for directory in (Path(env.ADMIN_STAGING_DIR), store.staging_dir):
        if directory.is_dir():
            for path in directory.iterdir():
                if path.is_file():
                    path.unlink(missing_ok=True)


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
    pixel_size: float | None,
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
        pixel_size = validation.pixel_size_m
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
