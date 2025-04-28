from fastapi import APIRouter
from app.models.maps import BaseMapData
from app.utils.maps import read_attributes, read_considerations
from app.modules.maps.helpers import get_all_maps


router = APIRouter()


@router.get("", response_model=list[BaseMapData])
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
        - availableCountriesCodes: List of ISO 3166-1 alpha-2 country codes
          available in the layer
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
                availableCountriesCodes=map.get("available_countries_codes", []),
            )
        )

    return parsed_maps
