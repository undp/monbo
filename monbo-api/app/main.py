import json
import os
from urllib.parse import unquote

from app.modules import (
    deforestation_analysis_router,
    polygons_validation_router,
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
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


@app.get("/health")
async def health_check():
    return {"version": "0.1.0", "status": "OK"}


@app.get("/download-geojson")
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


app.include_router(polygons_validation_router)
app.include_router(deforestation_analysis_router)
