from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from io import BytesIO
from app.modules.deforestation_analysis.map_generation.helpers import (
    generate_deforestation_results_image,
    NoRasterDataOverlapError,
)
from app.modules.deforestation_analysis.helpers import get_map_by_id
from app.utils.maps import get_map_raster_path
from pydantic import BaseModel


router = APIRouter()


class GenerateForPolygonBody(BaseModel):
    feature: dict  # geojson feature
    mapId: int


@router.post("/generate-for-polygon")
async def generate_for_polygon(body: GenerateForPolygonBody):
    raster_filename = get_map_by_id(body.mapId)["raster_filename"]
    raster_path = get_map_raster_path(raster_filename)

    try:
        img = generate_deforestation_results_image(body.feature, raster_path)
    except NoRasterDataOverlapError as e:
        raise HTTPException(status_code=404, detail=str(e))

    img_io = BytesIO()
    img.save(img_io, format="PNG")
    img_io.seek(0)

    return Response(img_io.read(), media_type="image/png")
