"""Raster ingestion: validate an uploaded raster, convert it to a COG and activate it.

An upload is staged on the container's local disk (`ADMIN_STAGING_DIR`), because the
exhaustive scan and the verification are I/O-bound and much slower over the Azure
Files share. Only the finished, verified COG is copied to the share, renamed to a
new versioned filename (rasters are never overwritten) and written to the index.

Only one ingestion runs at a time. Job state lives on the share (`.jobs/`), so the
admin UI can poll it and a restart can mark interrupted jobs as failed.
"""

import math
import os
import re
import shutil
import threading
import warnings
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
import rasterio.shutil
from rasterio.errors import NotGeoreferencedWarning, RasterioIOError
from rasterio.windows import Window

from app.config import env
from app.modules.layers.store import LayerStore, get_layer_store

from .auth import logger

WINDOW_SIZE = 2048
MAX_REPORTED_VALUES = 10
LOSS_YEARS = range(1980, 2101)
COG_OPTIONS = {
    "compress": "DEFLATE",
    "predictor": 2,
    "blocksize": 512,
    "overview_resampling": "nearest",
    "BIGTIFF": "IF_SAFER",
}


class IngestionError(Exception):
    """A problem with the uploaded raster, reported to the admin.

    `code` and `params` let the admin UI show it in the user's language; the English
    message is the fallback.
    """

    def __init__(self, code: str, message: str, **params):
        super().__init__(message)
        self.code = code
        self.params = params

    def as_issue(self) -> dict:
        return issue(self.code, str(self), **self.params)


def issue(code: str, message: str, **params) -> dict:
    return {"code": code, "message": message, "params": params}


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


def new_job(job_id: str, layer_id: int, nodata: float | None) -> dict:
    now = _now()
    return {
        "jobId": job_id,
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


def recover_interrupted_jobs(store: LayerStore) -> None:
    """At startup: jobs left queued/running died with the previous process."""
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


# --- Validation --------------------------------------------------------------------


def _windows(width: int, height: int) -> Iterator[Window]:
    for row in range(0, height, WINDOW_SIZE):
        for col in range(0, width, WINDOW_SIZE):
            yield Window(
                col, row, min(WINDOW_SIZE, width - col), min(WINDOW_SIZE, height - row)
            )


def _distinct_values(block: np.ndarray) -> set[int]:
    if block.dtype == np.uint8:  # the usual case: much faster than np.unique
        counts = np.bincount(block.ravel(), minlength=256)
        return set(np.flatnonzero(counts).tolist())
    return {int(value) for value in np.unique(block)}


def _approx_resolution_m(src) -> float | None:
    res_x, res_y = src.res
    try:
        if src.crs.is_geographic:
            lat = math.radians((src.bounds.top + src.bounds.bottom) / 2)
            return round((res_x * 111_320 * math.cos(lat) + res_y * 110_574) / 2, 2)
        return round((res_x + res_y) / 2 * src.crs.linear_units_factor[1], 2)
    except Exception:  # noqa: BLE001 - only a hint for the admin
        return None


def _format(value: float) -> str:
    return f"{value:g}"


@dataclass
class Validation:
    report: dict
    warnings: list[dict]
    # The nodata to store; set on the file first when it didn't declare one.
    nodata: float | None
    needs_nodata: bool


def validate_raster(path: Path, requested_nodata: float | None) -> Validation:
    """Structural checks plus a scan of every pixel."""
    try:
        with warnings.catch_warnings():
            # Rejected below with a clear message; no need for GDAL's warning.
            warnings.simplefilter("ignore", NotGeoreferencedWarning)
            src = rasterio.open(path)
    except RasterioIOError:
        raise IngestionError("not_geotiff", "The file is not a readable GeoTIFF")
    with src:
        if src.driver != "GTiff":
            raise IngestionError("not_geotiff", "The file is not a readable GeoTIFF")
        if src.count != 1:
            raise IngestionError(
                "band_count",
                f"The raster must have exactly one band (it has {src.count})",
                bands=src.count,
            )
        dtype = src.dtypes[0]
        if not np.issubdtype(np.dtype(dtype), np.integer):
            raise IngestionError(
                "not_integer",
                f"The raster must have integer values (it has {dtype}); "
                "use 0 for no loss and 1 for loss",
                dtype=dtype,
            )
        if src.crs is None:
            raise IngestionError(
                "no_crs", "The raster must have a coordinate reference system"
            )

        found_warnings: list[dict] = []
        declared = nodata = src.nodata
        if nodata is None:
            nodata = requested_nodata
        elif requested_nodata is not None and requested_nodata != nodata:
            found_warnings.append(
                issue(
                    "nodata_ignored",
                    f"The file already declares nodata {_format(nodata)}; "
                    f"the requested {_format(requested_nodata)} was ignored",
                    declared=nodata,
                    requested=requested_nodata,
                )
            )
        allowed = {0, 1} | ({int(nodata)} if nodata is not None else set())

        values: set[int] = set()
        for window in _windows(src.width, src.height):
            values |= _distinct_values(src.read(1, window=window))
            if len(values - allowed) >= MAX_REPORTED_VALUES:
                break  # enough to reject it

        report = {
            "crs": src.crs.to_string(),
            "width": src.width,
            "height": src.height,
            "bounds": [round(b, 6) for b in src.bounds],
            "dtype": dtype,
            "nodata": nodata,
            "values": sorted(values)[:20],
            "approxResolutionM": _approx_resolution_m(src),
        }

    offending = sorted(values - allowed)[:MAX_REPORTED_VALUES]
    if offending:
        legend = "0 = no loss, 1 = loss"
        if nodata is not None:
            legend += f", {_format(nodata)} = nodata"
        message = (
            f"The raster must be binary ({legend}). Other values found: "
            f"{', '.join(str(value) for value in offending)}."
        )
        if all(value in LOSS_YEARS for value in offending):
            message += (
                " They look like loss years: binarize the layer against its "
                "baseline year before uploading."
            )
            raise IngestionError("loss_years", message, values=offending)
        if nodata is None:
            message += " If one of them marks nodata, upload again with that nodata."
        raise IngestionError("not_binary", message, values=offending, nodata=nodata)
    if 1 not in values:
        found_warnings.append(
            issue("no_loss_pixels", "No deforestation pixels (value 1) were found")
        )
    return Validation(report, found_warnings, nodata, needs_nodata=declared is None)


# --- Conversion and verification ---------------------------------------------------


def set_nodata(path: Path, nodata: float) -> None:
    with rasterio.open(path, "r+") as dataset:
        dataset.nodata = nodata


def convert_to_cog(src_path: Path, dst_path: Path) -> None:
    options = dict(COG_OPTIONS)
    with rasterio.open(src_path) as src:
        nbits = src.tags(1, ns="IMAGE_STRUCTURE").get("NBITS")  # a band tag
    if nbits and int(nbits) < 8:
        # Bit-packed input (e.g. ecuador2.tif is 2-bit): the predictor needs whole
        # bytes, so store 8-bit samples. The values don't change.
        options["NBITS"] = 8
    rasterio.shutil.copy(str(src_path), str(dst_path), driver="COG", **options)


def verify_same_pixels(original: Path, converted: Path) -> None:
    with rasterio.open(original) as a, rasterio.open(converted) as b:
        same_grid = (a.width, a.height, a.crs, a.transform, a.nodata) == (
            b.width,
            b.height,
            b.crs,
            b.transform,
            b.nodata,
        )
        if not same_grid:
            raise IngestionError(
                "conversion_mismatch",
                "The converted raster doesn't match the upload's grid; nothing changed",
            )
        for window in _windows(a.width, a.height):
            if not np.array_equal(a.read(1, window=window), b.read(1, window=window)):
                raise IngestionError(
                    "conversion_mismatch",
                    "The converted raster doesn't match the upload's pixels; "
                    "nothing changed",
                )


# --- Activation --------------------------------------------------------------------


def _raster_stem(entry: dict) -> str:
    filename = entry.get("raster_filename")
    if not filename:
        return f"layer-{entry['id']}"
    return re.sub(r"-v\d+$", "", Path(filename).stem)


def activate(store: LayerStore, layer_id: int, cog: Path, job_id: str) -> dict:
    """Copy the COG to the share, give it a new versioned name and point the layer
    at it. Returns the updated index entry."""
    share_staging = store.staging_dir / f"{job_id}.tif"
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
    job_id: str, layer_id: int, staged: Path, requested_nodata: float | None
) -> None:
    """Background task: validate, convert, verify and activate one upload."""
    store = get_layer_store()
    job = store.read_job(job_id) or new_job(job_id, layer_id, requested_nodata)
    cog = staged.with_name(f"{job_id}.cog.tif")
    try:
        _save(store, job, status="running")
        validation = validate_raster(staged, requested_nodata)
        _save(store, job, report=validation.report, warnings=validation.warnings)
        if validation.nodata is not None and validation.needs_nodata:
            set_nodata(staged, validation.nodata)
        convert_to_cog(staged, cog)
        verify_same_pixels(staged, cog)
        entry = activate(store, layer_id, cog, job_id)
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
