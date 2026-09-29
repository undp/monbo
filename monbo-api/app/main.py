import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import unquote

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from app.config import env
from app.config.logger import configure_logging, get_logger
from app.modules import (
    admin_router,
    deforestation_analysis_router,
    farms_router,
    maps_router,
    polygons_validation_router,
)
from app.modules.admin.auth import admin_enabled
from app.modules.admin.ingestion import recover_interrupted_jobs
from app.modules.layers.store import get_layers_root

# Configure the logger
configure_logging(level=logging.INFO)  # Adjust level as needed
logger = get_logger("main")

router = APIRouter()


@router.get("/")
async def root():
    """
    Root endpoint that serves the API status page.
    Returns an HTML page with a spinning gear animation indicating the API is running.
    If the template file is not found, returns a simple fallback HTML response.

    Returns:
        Response: HTML content with status page
    """
    # Load HTML content from file
    template_path = os.path.join(os.path.dirname(__file__), "templates/index.html")

    try:
        with open(template_path, "r") as file:
            html_content = file.read()
    except FileNotFoundError:
        # Fallback in case the file doesn't exist
        html_content = "<html><body><h1>Monbo API is running</h1></body></html>"

    return Response(content=html_content, media_type="text/html")


@router.get("/health")
def health_check():
    # Sync on purpose: checking the maps root may touch a network share (Azure
    # Files), so it runs in the threadpool instead of blocking the event loop.
    root = get_layers_root()
    return {
        "version": "0.1.0",
        "status": "OK",
        "mapsRoot": str(root.root.resolve()),
        "mapsRootWritable": root.is_writable(),
    }


@router.get("/download-geojson")
async def download_geojson(content: str | None = None):
    if content:
        try:
            # Decode URI-encoded string
            decoded_str = unquote(content)
            geojson_data = json.loads(decoded_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid GeoJSON format")
    else:
        raise HTTPException(status_code=400, detail="Missing GeoJSON content")

    # Convert to JSON string
    json_str = json.dumps(geojson_data)

    # Return as downloadable file
    headers = {
        "Content-Disposition": "attachment; filename=farm-deforestation-report.geojson",
        "Content-Type": "application/json",
    }

    return Response(content=json_str, headers=headers)


def _warn_about_admin_configuration() -> None:
    if env.LEGACY_ADMIN_PASSKEY_HASH_SET:
        logger.warning(
            "ADMIN_PASSKEY_HASH is ignored: each country's passkey now lives in the "
            "country registry (uv run python -m app.modules.admin.countries)"
        )
    if not admin_enabled():
        if env.ADMIN_SESSION_SECRET:
            logger.warning(
                "Layers admin disabled: MAPS_ROOT (%s) has the flat layout; the admin "
                "needs the per-country layout (see "
                "app.modules.layers.migrate_countries)",
                env.MAPS_ROOT,
            )
        return
    bundled_maps = (Path(__file__).parent / "maps").resolve()
    if Path(env.MAPS_ROOT).resolve().is_relative_to(bundled_maps):
        logger.warning(
            "Layers admin is enabled while MAPS_ROOT points at the bundled layers "
            "(%s): admin writes will modify Git-tracked files (and are lost on "
            "restart inside a container)",
            bundled_maps,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    if admin_enabled():
        try:
            await run_in_threadpool(recover_interrupted_jobs, get_layers_root())
        except Exception:
            # Don't keep the public API down because the share is unreachable.
            logger.exception("Could not recover interrupted ingestion jobs")
    yield


def create_app() -> FastAPI:
    # A root holding both layouts is ambiguous: refuse to start (LayoutError).
    get_layers_root().is_per_country()
    app = FastAPI(lifespan=lifespan)
    # Admin calls authenticate with a Bearer header, never cookies, so credentials
    # stay off; the admin routes check the Origin header themselves.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(polygons_validation_router)
    app.include_router(deforestation_analysis_router)
    app.include_router(maps_router)
    app.include_router(farms_router)
    # Without the session secret and a per-country root the admin routes don't
    # exist at all (404, and they are left out of the OpenAPI docs).
    if admin_enabled():
        app.include_router(admin_router)
    _warn_about_admin_configuration()
    return app


app = create_app()
