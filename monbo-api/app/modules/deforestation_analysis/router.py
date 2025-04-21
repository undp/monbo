from datetime import datetime, timedelta
from io import BytesIO

from app.models.farms import FarmData
from app.models.maps import BaseMapData
from app.modules.deforestation_analysis.helpers import (
    get_all_maps,
    get_deforestation_ratio,
    get_map_by_id,
    get_map_pixels_inside_polygon,
    get_pixel_area,
    get_tile,
)
from app.utils.farms import parse_base_information
from app.utils.maps import get_map_raster_path, read_attributes, read_considerations
from app.utils.polygons import (
    get_polygon_area,
)
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from rasterio import open as rasterio_open

from .models import AnalizeBody, DeforestationUnprocessedFarmData, MapData

router = APIRouter()


@router.get("/get-maps", response_model=list[BaseMapData])
def get_maps(language: str = "en"):
    """
    Retrieve a list of maps with their metadata and attributes.

    This endpoint reads the maps index file and their corresponding metadata
    files to return detailed information about each available map layer.

    Args:
        language (str, optional): Language code for the metadata. Defaults to "en".

    Returns:
        list[BaseMapData]: A list of maps with the following attributes:
        - id: Unique identifier for the map layer
        - name: Complete name of the layer (e.g., "Global Forest Watch")
        - alias: Short name or reference (e.g., "GFW 2020-2023")
        - baseline: Base year for comparison
        - comparedAgainst: Final year for comparison
        - coverage: Geographic coverage of the layer
        - source: Origin of the layer data
        - resolution: Spatial resolution (e.g., "30 x 30 meters")
        - contentDate: Period covered by the data
        - updateFrequency: How often the data is updated
        - publishDate: When the map data was published/released
        - references: Reference URLs for the data source
        - considerations: Special considerations and notes about the layer
          (in Markdown format)
    """
    maps = get_all_maps()

    parsed_maps = []
    for map in maps:
        attributes_dict = read_attributes(map["attributes_filename"], language)
        considerations_text = read_considerations(
            map["considerations_filename"], language
        )

        parsed_maps.append(
            BaseMapData(
                id=map["id"],
                name=attributes_dict.get("name") if attributes_dict else None,
                alias=attributes_dict.get("alias") if attributes_dict else None,
                baseline=int(map["baseline"]) if map["baseline"] else None,
                comparedAgainst=(
                    int(map["compared_against"]) if map["compared_against"] else None
                ),
                coverage=attributes_dict.get("coverage") if attributes_dict else None,
                source=attributes_dict.get("source") if attributes_dict else None,
                resolution=(
                    attributes_dict.get("resolution") if attributes_dict else None
                ),
                contentDate=(
                    attributes_dict.get("contentDate") if attributes_dict else None
                ),
                updateFrequency=(
                    attributes_dict.get("updateFrequency") if attributes_dict else None
                ),
                publishDate=(
                    attributes_dict.get("publishDate") if attributes_dict else None
                ),
                references=map.get("references", []),
                considerations=considerations_text,
            )
        )

    return parsed_maps


@router.post("/parse-farms", response_model=list[FarmData])
def parse_farms(body: list[DeforestationUnprocessedFarmData]) -> list[FarmData]:
    """
    Parses farm data from the provided body and returns a list of FarmData objects.

    Args:
        body (list[DeforestationUnprocessedFarmData]): The body containing farm
        polygons and related information.

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
        try:
            raster_path = get_map_raster_path(map_data["raster_filename"])
            with rasterio_open(raster_path) as src:
                for farm in farms:
                    try:
                        polygon = farm.get_polygon()
                        loss_year_data = get_map_pixels_inside_polygon(polygon, src)
                        pixel_area = get_pixel_area(map_data)
                        deforestation_ratio = get_deforestation_ratio(
                            loss_year_data,
                            get_polygon_area(polygon),
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
        img = get_tile(asset_path, z, x, y)
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
