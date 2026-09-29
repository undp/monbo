"""Raster ingestion: validate an uploaded raster, convert it to a COG and activate it.

An upload is staged on the container's local disk (`ADMIN_STAGING_DIR`), because the
exhaustive scan and the verification are I/O-bound and much slower over the Azure
Files share. Only the finished, verified COG is copied to the share, renamed to a
new versioned filename (rasters are never overwritten) and written to the index.

Only one ingestion runs at a time, across every country. Job state lives on the
share (`.jobs/` at the root, each job recording its country), so the admin UI can
poll it and a restart can mark interrupted jobs as failed.
"""

import os
import re
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.config import env
from app.modules.layers.processing import (
    IngestionError,
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
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.job_id: str | None = None

    def acquire(self, job_id: str) -> bool:
        with self._lock:
            if self.job_id is not None:
                return False
            self.job_id = job_id
            return True

    def release(self, job_id: str) -> None:
        with self._lock:
            if self.job_id == job_id:
                self.job_id = None


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
    root: LayersRoot, store: LayerStore, layer_id: int, cog: Path, job_id: str
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


def run_ingestion(
    job_id: str,
    country: str,
    layer_id: int,
    staged: Path,
    requested_nodata: float | None,
) -> None:
    """Background task: validate, convert, verify and activate one upload."""
    root = get_layers_root()
    store = root.flat  # jobs live at the root
    job = store.read_job(job_id) or new_job(job_id, country, layer_id, requested_nodata)
    cog = staged.with_name(f"{job_id}.cog.tif")
    try:
        _save(store, job, status="running")
        validation = validate_raster(staged, requested_nodata)
        _save(store, job, report=validation.report, warnings=validation.warnings)
        if validation.nodata is not None and validation.needs_nodata:
            set_nodata(staged, validation.nodata)
        convert_to_cog(staged, cog)
        verify_same_pixels(staged, cog)
        entry = activate(root, root.country_store(country), layer_id, cog, job_id)
        _save(
            store,
            job,
            status="succeeded",
            rasterFilename=entry["raster_filename"],
            version=entry["version"],
        )
        logger.info(
            "Admin ingested %s for layer %s", entry["raster_filename"], layer_id
        )
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
    try:
        _save(store, job, status="failed", error=error)
    except Exception:
        logger.exception("Could not record the failure of job %s", job["jobId"])
