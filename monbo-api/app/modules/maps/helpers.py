from fastapi import HTTPException

from app.modules.layers.store import get_layer_store


def get_all_maps() -> list[dict]:
    """
    Retrieve every entry of the layers index, enabled or not.

    Each entry is the raw index object (`id`, `raster_filename`,
    `attributes_filename`, `considerations_filename`, `pixel_size`, `baseline`,
    `compared_against`, `references`, `available_countries_codes`) plus `enabled`
    and `version`, which default to `True` and `1` for entries that predate them.
    Callers that list layers publicly must filter on `enabled`; analysis, tiles
    and image generation resolve layers by id regardless of it.
    Returns:
        list[dict]: The index entries.
    Raises:
        HTTPException: 500 if the index cannot be read.
    """
    maps = get_layer_store().read_index()
    if maps is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")

    return maps


def get_map_by_id(mapId: int) -> dict | None:
    """
    Retrieve a map by its ID, enabled or not.
    Args:
        mapId (int): The ID of the map to retrieve.
    Returns:
        dict | None: The index entry for that ID, or None if there is none.
    """
    maps = get_all_maps()

    requested_map = next(filter(lambda x: x["id"] == mapId, maps), None)
    return requested_map
