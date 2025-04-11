from fastapi import APIRouter, HTTPException

from app.models.farms import FarmData
from fastapi.responses import Response
from datetime import datetime, timedelta

from app.models.maps import BaseMapData
from app.modules.deforestation_analysis.helpers import (
    get_all_maps,
    get_deforestation_percentage,
    get_map_by_id,
    get_map_pixels_inside_polygon,
    get_pixel_area,
    get_tile,
)
from app.utils.farms import parse_base_information
from .models import AnalizeBody, MapData, DeforestationUnprocessedFarmData
import io
import rasterio

from app.utils.polygons import (
    get_polygon_area,
)

router = APIRouter()


@router.get("/get-maps", response_model=list[BaseMapData])
def get_maps():
    """
    Retrieve a list of maps with specific attributes.

    This function reads a JSON file containing map data and returns a list of maps,
    each represented by a BaseMapData object with the following attributes:
    - id: The unique identifier of the map.
    - name: The name of the map.
    - alias: An alias for the map.

    Returns:
        list[BaseMapData]: A list of BaseMapData objects containing the 'id', 'name', and 'alias' of each map.
    """
    maps = get_all_maps()

    return list(
        map(
            lambda x: BaseMapData(
                id=x["id"],
                name=x["name"],
                alias=x["alias"],
                baseline=int(x["baseline"]),
                comparedAgainst=int(x["compared_against"]),
                coverage=x["coverage"],
                source=x["source"],
                resolution=x["resolution"],
                contentDate=x["contentDate"],
                updateFrequency=x["updateFrequency"],
                reference=x["reference"],
                considerations=x["considerations"],
            ),
            maps,
        )
    )


@router.get("/get-maps/{mapId}")
def get_map(mapId: int):
    """
    Retrieve a map by its ID.
    Args:
        mapId (int): The ID of the map to retrieve.
    Returns:
        dict: The map data corresponding to the provided ID.
    Raises:
        HTTPException: If no map with the given ID is found.
    This endpoint reads from a JSON file containing map data and returns the map
    that matches the provided ID. If no such map is found, a 404 HTTP exception
    is raised with the message "Map not found".
    """
    requested_map = get_map_by_id(mapId)
    if requested_map is None:
        raise HTTPException(status_code=404, detail="Map not found")
    return requested_map


@router.post("/parse-farms", response_model=list[FarmData])
def parse_farms(body: list[DeforestationUnprocessedFarmData]) -> list[FarmData]:
    """
    Parses farm data from the provided body and returns a list of FarmData objects.

    Args:
        body (list[DeforestationUnprocessedFarmData]): The body containing farm polygons and related information.

    Returns:
        list[FarmData]: A list of FarmData objects containing parsed farm information.
    """
    farm_data = []
    for farm in body:
        base_information = parse_base_information(farm)
        # TODO: Add potential additional information
        farm_data.append(base_information)
    return farm_data


@router.post("/analize", response_model=list[MapData])
def analize(body: AnalizeBody):
    maps = get_all_maps()

    farms = body.farms
    requested_maps = list(filter(lambda x: x["id"] in body.maps, maps))
    results = []

    for map_data in requested_maps:
        farmsResults = []
        asset_name = map_data["asset_name"]
        try:
            with rasterio.open(f"app/map_assets/{asset_name}") as src:
                for farm in farms:
                    try:
                        polygon = farm.get_polygon()
                        loss_year_data = get_map_pixels_inside_polygon(polygon, src)
                        pixel_area = get_pixel_area(map_data)
                        deforested_percentage = get_deforestation_percentage(
                            loss_year_data,
                            get_polygon_area(polygon),
                            pixel_area,
                        )
                        farmsResults.append(
                            {
                                "farmId": farm.id,
                                "value": deforested_percentage,
                            }
                        )
                    except Exception as e:
                        print(
                            f"Error processing farm {farm.id} for map {map_data['id']}: {e}"
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

    asset_path = f"app/map_assets/{map['asset']['name']}"

    try:
        img = get_tile(asset_path, z, x, y)
        img_io = io.BytesIO()
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
