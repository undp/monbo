from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi import Path as PathParam
from fastapi.responses import Response
from pydantic import BaseModel
from rasterio import open as rasterio_open
from shapely.geometry import shape
from starlette.concurrency import run_in_threadpool

from app.helpers.GeometryCalculator import GeometryCalculator
from app.models.maps import COUNTRY_CODE_PATTERN, CountryCode
from app.modules.deforestation_analysis.helpers import (
    get_deforestation_ratio,
    get_map_pixels_inside_polygon,
    get_pixel_area,
    get_tile,
)
from app.modules.layers.store import is_layer
from app.modules.maps.helpers import get_country_maps, get_map_by_id, require_country
from app.utils.farms import get_farm_coords_and_radius
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.MapImageGenerator import MapImageGenerator
from app.utils.maps import get_map_raster_path
from app.utils.polygons import (
    generate_polygon,
)

from .models import AnalizeBody, MapData

router = APIRouter()


@router.post("/analize", response_model=list[MapData])
def analize(body: AnalizeBody):
    require_country(body.country)
    maps = get_country_maps(body.country)

    farms = body.farms
    requested_maps = [
        map
        for map in maps
        if map["id"] in body.maps and is_layer(map, body.country, map["id"])
    ]
    unknown = sorted(set(body.maps) - {map["id"] for map in requested_maps})
    if unknown:
        # An empty "successful" analysis would hide the mistake.
        raise HTTPException(
            status_code=400,
            detail=f"Unknown layers for {body.country or 'the request'}: {unknown}",
        )
    results = []

    for map_data in requested_maps:
        farmsResults = []
        try:
            raster_path = get_map_raster_path(map_data)
            with rasterio_open(raster_path) as src:
                for farm in farms:
                    try:
                        coords, radius = get_farm_coords_and_radius(farm)
                        polygon = generate_polygon(coords, radius)
                        loss_year_data = get_map_pixels_inside_polygon(polygon, src)
                        pixel_area = get_pixel_area(map_data)
                        deforestation_ratio = get_deforestation_ratio(
                            loss_year_data,
                            GeometryCalculator.calculate_polygon_area(polygon),
                            pixel_area,
                        )
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
    # The layer version the analysis used (from /analize). When given and the layer
    # has a newer raster, the image would not match the results: 409.
    version: int | None = None


@router.post("/generate-image")
async def generate_image(
    body: GenerateImageBody,
    include_satelital_background: bool = Query(
        True, description="Whether to include satellite imagery as background"
    ),
):
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
        # Check geometry type and pass point_radius_meters only for Point geometries
        if geom.geom_type == "Point":
            point_radius_meters = 50  # TODO: get from body when new excel is ready
            img = await MapImageGenerator.generate(
                geom,
                raster_path,
                point_radius_meters,
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
