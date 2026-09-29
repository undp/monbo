from fastapi import HTTPException

from app.modules.layers.store import get_layers_root, is_layer


def get_all_maps() -> list[dict]:
    """
    Retrieve every layer of every country, enabled or not.

    Each entry is the raw index object (`id`, `raster_filename`,
    `attributes_filename`, `considerations_filename`, `pixel_size`, `baseline`,
    `compared_against`, `references`) plus:
    - `enabled` and `version`, which default to `True` and `1` for entries that
      predate them;
    - `country`: the layer's country, or None in the legacy flat layout;
    - `available_countries_codes`: `[country]`, or the layer's own list in the
      flat layout.
    Callers that list layers publicly must filter on `enabled`; analysis, tiles
    and image generation resolve layers by id regardless of it.
    Returns:
        list[dict]: The layers.
    Raises:
        HTTPException: 500 if the index cannot be read.
    """
    maps = get_layers_root().layers()
    if maps is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")

    return maps


def require_country(country: str | None) -> None:
    """Ids are numbered within each country in the per-country layout, so a layer
    can only be found with its country (the flat layout's ids are global)."""
    if country is None and get_layers_root().is_per_country():
        raise HTTPException(status_code=422, detail="country is required")


def get_map_by_id(mapId: int, country: str | None = None) -> dict | None:
    """
    Retrieve a layer by its country and id, enabled or not.
    Args:
        mapId (int): The layer's id within its country.
        country (str, optional): ISO 3166-1 alpha-2 code. Required in the
            per-country layout; in the flat layout, the layer must list it.
    Returns:
        dict | None: The layer (as in `get_all_maps`), or None if there is none.
    Raises:
        HTTPException: 422 if the country is required and missing, 500 if the
            index cannot be read.
    """
    require_country(country)
    return next((map for map in get_all_maps() if is_layer(map, country, mapId)), None)
