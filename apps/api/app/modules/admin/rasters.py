"""Raster upload and ingestion job status, for the admin session's country."""

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from app.config import env
from app.modules.layers.store import get_layers_root

from .auth import Session, require_admin
from .ingestion import (
    ingestion_in_progress,
    ingestion_slot,
    new_job,
    refresh_job,
    run_ingestion,
)
from .models import IngestionJob, JobAccepted, JobCancelled

router = APIRouter()


def _layer_exists(country: str, layer_id: int) -> bool:
    index = get_layers_root().country_store(country).read_index()
    if index is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")
    return any(entry["id"] == layer_id for entry in index)


def _too_large() -> HTTPException:
    return HTTPException(
        status_code=413,
        detail=f"The raster is larger than {env.ADMIN_MAX_UPLOAD_MB} MB",
    )


@router.put("/layers/{layer_id}/raster", status_code=202, response_model=JobAccepted)
async def upload_raster(
    layer_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    nodata: float | None = Query(
        None,
        description="Nodata value, for rasters whose file doesn't declare one",
    ),
    session: Session = Depends(require_admin),
):
    """
    Upload a GeoTIFF for a layer as the raw request body (not multipart). It is
    validated, converted to a Cloud Optimized GeoTIFF and activated in the
    background; poll `GET /admin/jobs/{jobId}` for the result, or cancel it with
    `DELETE /admin/jobs/{jobId}`. The layer keeps its current raster until the job
    succeeds. Only one upload is processed at a time, across every country.
    """
    if nodata is not None and not nodata.is_integer():
        raise HTTPException(status_code=422, detail="nodata must be a whole number")
    country = session.country
    if not await run_in_threadpool(_layer_exists, country, layer_id):
        raise HTTPException(status_code=404, detail="Layer not found")

    limit = env.ADMIN_MAX_UPLOAD_MB * 1024 * 1024
    declared_size = request.headers.get("content-length")
    if declared_size and declared_size.isdigit() and int(declared_size) > limit:
        raise _too_large()

    busy = HTTPException(
        status_code=409, detail="Another raster is being processed; try later"
    )
    # Also covers a previous revision still ingesting while a deploy rolls out.
    if await run_in_threadpool(ingestion_in_progress, get_layers_root().flat):
        raise busy
    job_id = uuid.uuid4().hex
    if not ingestion_slot.acquire(job_id):
        raise busy

    staged = Path(env.ADMIN_STAGING_DIR) / f"{job_id}.tif"
    try:
        await run_in_threadpool(staged.parent.mkdir, parents=True, exist_ok=True)
        size = 0
        with open(staged, "wb") as file:
            async for chunk in request.stream():
                size += len(chunk)
                if size > limit:  # also covers chunked uploads without a length
                    raise _too_large()
                await run_in_threadpool(file.write, chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="The request body is empty")
        # The client may have given up once the whole body was sent (the admin UI's
        # Cancel at 100%): don't start a job nobody will follow.
        if await request.is_disconnected():
            raise HTTPException(status_code=400, detail="The upload was cancelled")
        await run_in_threadpool(
            get_layers_root().flat.write_job,
            new_job(job_id, country, layer_id, nodata),
        )
    except BaseException:
        # Too large, empty, client disconnected...: nothing is left behind.
        staged.unlink(missing_ok=True)
        ingestion_slot.release(job_id)
        raise

    background_tasks.add_task(run_ingestion, job_id, country, layer_id, staged, nodata)
    return {"jobId": job_id}


def _country_job(job_id: str, session: Session) -> dict:
    """A job of the session's country, as the admin should see it (a job no process
    has updated for a long time is failed as interrupted)."""
    store = get_layers_root().flat
    job = store.read_job(job_id)
    if job is None or job.get("country") != session.country:
        raise HTTPException(status_code=404, detail="Job not found")
    return refresh_job(store, job)


@router.get("/jobs/{job_id}", response_model=IngestionJob)
def get_job(job_id: str, session: Session = Depends(require_admin)):
    """Status of an ingestion job of the session's country: queued, running,
    succeeded, failed or cancelled, with the phase and progress while running."""
    return _country_job(job_id, session)


@router.delete("/jobs/{job_id}", status_code=202, response_model=JobCancelled)
def cancel_job(job_id: str, session: Session = Depends(require_admin)):
    """
    Cancel a queued or running job of the session's country. A 202 guarantees the
    layer keeps its raster; the job reports `cancelled` once it stops (at the
    latest when a running conversion returns). 409 when the job has ended or its
    activation has begun.
    """
    job = _country_job(job_id, session)
    if job["status"] not in ("queued", "running"):
        raise HTTPException(status_code=409, detail="The job has already ended")
    if ingestion_slot.cancel(job_id) != "cancelled":
        raise HTTPException(
            status_code=409, detail="The job is activating its raster or has ended"
        )
    return {"jobId": job_id, "cancelled": True}
