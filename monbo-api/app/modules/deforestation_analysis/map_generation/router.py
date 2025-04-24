from io import BytesIO

from app.modules.deforestation_analysis.helpers import get_map_by_id
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.MapImageGenerator import MapImageGenerator
from app.utils.maps import get_map_raster_path
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from shapely.geometry import shape


router = APIRouter()


class GenerateForPolygonBody(BaseModel):
    feature: dict  # geojson feature
    mapId: int


@router.post("/generate-for-polygon")
async def generate_for_polygon(body: GenerateForPolygonBody):
    raster_filename = get_map_by_id(body.mapId)["raster_filename"]
    raster_path = get_map_raster_path(raster_filename)

    try:
        geom = shape(body.feature["geometry"])
        # Check geometry type and pass point_radius_meters only for Point geometries
        if geom.geom_type == "Point":
            point_radius_meters = 50  # TODO: get from body when new excel is ready
            img = await MapImageGenerator.generate(
                geom, raster_path, point_radius_meters
            )
        else:  # For Polygon or other geometries
            img = await MapImageGenerator.generate(geom, raster_path)
    except NoRasterDataOverlapError as e:
        raise HTTPException(status_code=404, detail=str(e))

    img_io = BytesIO()
    img.save(img_io, format="PNG")
    img_io.seek(0)

    return Response(img_io.read(), media_type="image/png")
