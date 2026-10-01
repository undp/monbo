from typing import Annotated

from fastapi import APIRouter, Query

from app.models.maps import COUNTRY_CODE_PATTERN, BaseMapData
from app.modules.layers.store import get_layers_root
from app.modules.maps.helpers import get_all_maps
from app.utils.maps import read_attributes, read_considerations

router = APIRouter()


@router.get("", response_model=list[BaseMapData])
def get_maps(
    language: str = "en",
    country: Annotated[str | None, Query(pattern=COUNTRY_CODE_PATTERN)] = None,
):
    """
    Retrieve the enabled maps with their metadata and attributes.

    This endpoint reads the maps index file and their corresponding metadata
    files to return detailed information about each enabled map layer. Disabled
    layers are left out here but remain usable by id for analysis and tiles.

    Args:
        language (str, optional): Language code for the metadata. Defaults to "en".
        country (str, optional): ISO 3166-1 alpha-2 code: only that country's
            layers (an empty list for a country that is unknown or disabled).
            Without it, the layers of every enabled country.

    Returns:
        list[BaseMapData]: A list of maps with the following attributes:
        - id: The layer's id within its country (with the legacy flat layout,
          unique on its own). Analysis, tiles and image generation take it with
          the country
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
        - availableCountriesCodes: The layer's country, as a one-element list of
          ISO 3166-1 alpha-2 codes (in the legacy flat layout, every country the
          layer lists)
        - version: Raster version, incremented on every raster replacement (the
          frontend appends it to tile URLs to bypass cached tiles)
        - pixelSize: Nominal pixel size in meters, used by the analysis formula
    """
    enabled_countries = get_layers_root().enabled_countries()
    maps = [
        map
        for map in get_all_maps()
        if map["enabled"]
        and (country is None or country in map["available_countries_codes"])
        and (
            enabled_countries is None
            or enabled_countries & set(map["available_countries_codes"])
        )
    ]

    parsed_maps = []
    for map in maps:
        attributes_dict = read_attributes(map, language)
        considerations_text = read_considerations(map, language)

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
                version=map["version"],
                pixelSize=map["pixel_size"],
            )
        )

    return parsed_maps
