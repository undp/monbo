from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi import Path as PathParam
from fastapi.responses import Response
from pydantic import BaseModel, Field
from rasterio import open as rasterio_open
from shapely.geometry import shape
from starlette.concurrency import run_in_threadpool

from app.helpers.GeometryCalculator import GeometryCalculator
from app.models.maps import COUNTRY_CODE_PATTERN, CountryCode
from app.modules.layer_analysis.helpers import (
    get_loss_area_fraction,
    get_tile,
)
from app.modules.layers.categories import invalid_index_fields, layer_id_of
from app.modules.layers.store import is_layer
from app.modules.maps.helpers import get_country_maps, get_map_by_id, require_country
from app.modules.usage.tracking import note_usage
from app.utils.farms import build_farm_geometry
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.MapImageGenerator import MapImageGenerator
from app.utils.maps import get_map_raster_path

from .models import AnalyzeBody, LayerResults

router = APIRouter()


@router.post("/analyze", response_model=list[LayerResults])
def analyze(body: AnalyzeBody, request: Request):
    # The usage event takes the analyzed country, not the X-Monbo-Country header.
    note_usage(request, country=body.country)
    require_country(body.country)
    maps = get_country_maps(body.country)

    farms = body.farms
    requested_maps = [
        map
        for map in maps
        if layer_id_of(map) in body.maps and is_layer(map, body.country, map["id"])
    ]
    unknown = sorted(set(body.maps) - {map["id"] for map in requested_maps})
    if unknown:
        # An empty "successful" analysis would hide the mistake.
        raise HTTPException(
            status_code=400,
            detail=f"Unknown layers for {body.country or 'the request'}: {unknown}",
        )
    invalid_version = [
        map["id"] for map in requested_maps if "version" in invalid_index_fields(map)
    ]
    if invalid_version:
        raise HTTPException(
            status_code=400,
            detail=f"Layers {invalid_version} of {body.country or 'the request'} can't "
            "be analyzed: their index field 'version' is invalid",
        )
    results = []

    for map_data in requested_maps:
        farmsResults = []
        try:
            raster_path = get_map_raster_path(map_data)
            with rasterio_open(raster_path) as src:
                for farm in farms:
                    try:
                        polygon = build_farm_geometry(farm)
                        polygon_area = GeometryCalculator.calculate_polygon_area(
                            polygon
                        )
                        # An invalid, empty or zero-area polygon can't be measured
                        deforestation_ratio = None
                        if polygon_area > 0:
                            deforestation_ratio = get_loss_area_fraction(polygon, src)
                        farmsResults.append(
                            {
                                "farmId": farm.id,
                                "value": deforestation_ratio,
                            }
                        )
                    except Exception as e:
                        print(
                            f"Error processing farm {farm.id} "
                            f"for map {map_data['id']}: {e}"
                        )
                        farmsResults.append({"farmId": farm.id, "value": None})
        except Exception as e:
            print(f"Error opening map {map_data['id']}: {e}")
            farmsResults = [{"farmId": farm.id, "value": None} for farm in farms]
        finally:
            results.append(
                {
                    "mapId": map_data["id"],
                    "version": map_data["version"],
                    "farmResults": farmsResults,
                }
            )

    note_usage(request, farms=len(farms), maps=len(requested_maps))
    return sorted(results, key=lambda x: x["mapId"])


@router.get("/tiles/{country}/{map_id}/dynamic/{z}/{x}/{y}.png")
async def serve_tile(
    country: Annotated[str, PathParam(pattern=COUNTRY_CODE_PATTERN)],
    map_id: int,
    z: int,
    x: int,
    y: int,
):
    """Serve a tile of a country's layer for the specified z/x/y."""
    # In the threadpool: the layer store takes a lock (held while an admin saves)
    # and may stat a network share, neither of which may block the event loop.
    map = await run_in_threadpool(get_map_by_id, map_id, country)
    if map is None:
        raise HTTPException(status_code=404, detail="Map not found")

    try:
        asset_path = get_map_raster_path(map)
    except FileNotFoundError:
        # e.g. a layer created in the admin that has no raster yet
        raise HTTPException(status_code=404, detail="Map raster not found")

    try:
        img = await get_tile(asset_path, z, x, y)
        img_io = BytesIO()
        img.save(img_io, format="PNG", compress_level=1)
        img_io.seek(0)

        # Set caching headers (e.g., cache for 1 day)
        headers = {
            "Cache-Control": "public, max-age=86400",  # Cache for 1 day
            "Last-Modified": datetime.now(timezone.utc).strftime(
                "%a, %d %b %Y %H:%M:%S GMT"
            ),
            "Expires": (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
                "%a, %d %b %Y %H:%M:%S GMT"
            ),
        }
        return Response(img_io.getvalue(), media_type="image/png", headers=headers)
    except Exception as e:
        print(f"Tile serving error: {e}")
        raise HTTPException(status_code=404, detail="Tile not found")


class GenerateImageBody(BaseModel):
    feature: dict  # geojson feature
    mapId: int
    # Required with the per-country layout (ids are numbered within each country).
    country: CountryCode | None = None
    # The layer version the analysis used (from /analyze). When given and the layer
    # has a newer raster, the image would not match the results: 409.
    version: int | None = None
    # The radius the analysis used for a point (required for one, ignored for a
    # polygon). The cap bounds the raster window a public request can ask for.
    pointRadiusMeters: float | None = Field(default=None, gt=0, le=10_000)


@router.post("/generate-image")
async def generate_image(
    body: GenerateImageBody,
    include_satelital_background: bool = Query(
        True, description="Whether to include satellite imagery as background"
    ),
):
    if (
        body.feature.get("geometry", {}).get("type") == "Point"
        and body.pointRadiusMeters is None
    ):
        raise HTTPException(
            status_code=400, detail="pointRadiusMeters is required for a point"
        )
    # In the threadpool, like serve_tile: the layer store may block.
    map_data = await run_in_threadpool(get_map_by_id, body.mapId, body.country)
    if map_data is None:
        raise HTTPException(status_code=404, detail="Map not found")
    if body.version is not None and body.version != map_data["version"]:
        raise HTTPException(
            status_code=409,
            detail="The map layer changed since the analysis; run it again",
        )
    try:
        raster_path = get_map_raster_path(map_data)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Map raster not found")

    try:
        geom = shape(body.feature["geometry"])
        # Pass the radius only for Point geometries
        if geom.geom_type == "Point":
            img = await MapImageGenerator.generate(
                geom,
                raster_path,
                body.pointRadiusMeters,
                include_satelital_background=include_satelital_background,
            )
        else:  # For Polygon or other geometries
            img = await MapImageGenerator.generate(
                geom,
                raster_path,
                include_satelital_background=include_satelital_background,
            )
    except NoRasterDataOverlapError as e:
        raise HTTPException(status_code=404, detail=str(e))

    content = await run_in_threadpool(_encode_jpeg, img)
    return Response(content, media_type="image/jpeg")


def _encode_jpeg(img) -> bytes:
    """JPEG, not PNG: the report embeds it as is, and it is several times smaller.
    The image is opaque (satellite or solid background), and 4:4:4 (no chroma
    subsampling) keeps the outline and the deforestation pixels sharp."""
    img_io = BytesIO()
    img.convert("RGB").save(img_io, format="JPEG", quality=85, subsampling=0)
    return img_io.getvalue()
