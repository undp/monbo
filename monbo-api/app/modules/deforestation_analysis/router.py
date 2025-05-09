from datetime import datetime, timedelta
from io import BytesIO
from pydantic import BaseModel
from shapely.geometry import shape
from app.modules.deforestation_analysis.helpers import (
    get_deforestation_ratio,
    get_map_pixels_inside_polygon,
    get_pixel_area,
    get_tile,
)
from app.modules.maps.helpers import get_all_maps, get_map_by_id
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.MapImageGenerator import MapImageGenerator
from app.helpers.GeometryCalculator import GeometryCalculator
from app.utils.maps import get_map_raster_path
from app.utils.polygons import (
    generate_polygon,
)
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from rasterio import open as rasterio_open
from .models import AnalizeBody, MapData


router = APIRouter()


@router.post("/analize", response_model=list[MapData])
def analize(body: AnalizeBody):
    maps = get_all_maps()

    farms = body.farms
    requested_maps = list(filter(lambda x: x["id"] in body.maps, maps))
    results = []

    for map_data in requested_maps:
        farmsResults = []
        try:
            raster_path = get_map_raster_path(map_data["raster_filename"])
            with rasterio_open(raster_path) as src:
                for farm in farms:
                    try:
                        coords = (
                            farm.details.path
                            if farm.type == "polygon"
                            else [farm.details.center]
                        )
                        radius = farm.details.radius if farm.type == "point" else None
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
            results.append({"mapId": map_data["id"], "farmResults": farmsResults})

    return sorted(results, key=lambda x: x["mapId"])


@router.get("/tiles/{map_id}/dynamic/{z}/{x}/{y}.png")
async def serve_tile(map_id: int, z: int, x: int, y: int):
    """Serve a tile for the specified z/x/y."""
    map = get_map_by_id(map_id)
    if map is None:
        raise HTTPException(status_code=404, detail="Map not found")

    asset_path = get_map_raster_path(map["raster_filename"])

    try:
        img = await get_tile(asset_path, z, x, y)
        img_io = BytesIO()
        img.save(img_io, format="PNG", compress_level=1)
        img_io.seek(0)

        # Set caching headers (e.g., cache for 1 day)
        headers = {
            "Cache-Control": "public, max-age=86400",  # Cache for 1 day
            "Last-Modified": datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "Expires": (datetime.utcnow() + timedelta(days=1)).strftime(
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


@router.post("/generate-image")
async def generate_image(
    body: GenerateImageBody,
    include_satelital_background: bool = Query(
        True, description="Whether to include satellite imagery as background"
    ),
):
    raster_filename = get_map_by_id(body.mapId)["raster_filename"]
    raster_path = get_map_raster_path(raster_filename)

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

    img_io = BytesIO()
    img.save(img_io, format="PNG")
    img_io.seek(0)

    return Response(img_io.read(), media_type="image/png")
