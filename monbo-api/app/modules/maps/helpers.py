from fastapi import HTTPException
from app.utils.json import read_json_file


def get_all_maps() -> list[dict]:
    """
    Retrieve a list of maps with specific attributes.
    This function reads a JSON file containing map data and returns a list of maps,
    each represented by a dictionary with the following attributes:
    - id: The unique identifier of the map.
    - name: The name of the map.
    - alias: An alias for the map.
    Returns:
        list[dict]: A list of dictionaries containing the 'id', 'name', and 'alias'
        of each map.
    """
    maps = read_json_file("app/maps/index.json")
    if maps is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")

    return maps


def get_map_by_id(mapId: int) -> dict:
    """
    Retrieve a map by its ID.
    Args:
        mapId (int): The ID of the map to retrieve.
    Returns:
        dict: The map data corresponding to the provided ID.
    Raises:
        HTTPException: If no map with the given ID is found.
    This function reads from a JSON file containing map data and returns the map
    that matches the provided ID. If no such map is found, a 404 HTTP exception
    is raised with the message "Map not found".
    """
    maps = get_all_maps()

    requested_map = next(filter(lambda x: x["id"] == mapId, maps), None)
    return requested_map
