import json
import logging
import os
from pathlib import Path
from urllib.parse import unquote

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

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
from app.modules.layers.store import get_layer_store

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
    store = get_layer_store()
    return {
        "version": "0.1.0",
        "status": "OK",
        "mapsRoot": str(store.root.resolve()),
        "mapsRootWritable": store.is_writable(),
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
    if not admin_enabled():
        if env.ADMIN_PASSKEY_HASH or env.ADMIN_SESSION_SECRET:
            logger.warning(
                "Layers admin disabled: set both ADMIN_PASSKEY_HASH and "
                "ADMIN_SESSION_SECRET to enable it"
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


def create_app() -> FastAPI:
    app = FastAPI()
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
    # Without both admin secrets the admin routes don't exist at all (404, and
    # they are left out of the OpenAPI docs).
    if admin_enabled():
        app.include_router(admin_router)
    _warn_about_admin_configuration()
    return app


app = create_app()
