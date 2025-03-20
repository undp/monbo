from fastapi import HTTPException
from app.models.farms import UnprocessedFarmData
from app.modules.polygons_validation.helpers import parse_farm_coordinates_data
from app.utils.polygons import generate_polygon, get_polygon_area


def parse_base_information(farm: UnprocessedFarmData):
    """
    Parses the base information of a farm and generates polygon details.

    Args:
        farm (UnprocessedFarmData): The unprocessed farm data.

    Returns:
        dict: A dictionary containing the parsed base information and polygon details.

    Raises:
        HTTPException: If there is an error parsing the farm coordinates or generating the polygon.

    The returned dictionary contains the following keys:
        - id (str): The farm ID.
        - producer (str): The name of the producer.
        - producerId (str): The producer ID (currently empty).
        - cropType (str): The type of crop.
        - productionDate (str): The production date.
        - production (float): The production quantity rounded to 2 decimal places.
        - productionQuantityUnit (str): The unit of the production quantity.
        - country (str): The country of the farm.
        - region (str): The region of the farm.
        - association (str): The association of the farm.
        - polygon (dict): A dictionary containing the polygon details with the following keys:
            - type (str): The type of the polygon ("polygon" or other).
            - details (dict): A dictionary containing the polygon details:
                - center (dict): A dictionary with the longitude and latitude of the center.
                - path (list): A list of dictionaries with the longitude and latitude of each point (if type is "polygon").
                - radius (int): The radius of the polygon (if type is not "polygon").
            - area (float): The area of the polygon.
    """
    try:
        farm.farmCoordinates = parse_farm_coordinates_data(farm.farmCoordinates)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"error": "coordinates-parsing-error", "id": farm.id},
        )
    base_information = {
        "id": farm.id,
        "producer": farm.producerName,
        "producerId": "",
        "cropType": farm.cropType,
        "productionDate": farm.productionDate,
        "production": round(farm.productionQuantity, 2),
        "productionQuantityUnit": farm.productionQuantityUnit,
        "country": farm.country,
        "region": farm.region,
        "association": farm.association,
    }
    try:
        (poly_type, polygon) = generate_polygon(farm.farmCoordinates)
        details = None
        if poly_type == "polygon":
            details = {
                "center": {
                    "lng": polygon.centroid.x,
                    "lat": polygon.centroid.y,
                },
                "path": [
                    {"lng": point.x, "lat": point.y} for point in farm.farmCoordinates
                ],
            }
        else:
            details = {
                "center": {
                    "lng": farm.farmCoordinates[0].x,
                    "lat": farm.farmCoordinates[0].y,
                },
                "radius": 100,
            }
        return {
            **base_information,
            "polygon": {
                "type": poly_type,
                "details": details,
                "area": get_polygon_area(polygon),
            },
        }
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"id": farm.id, "error": "polygon-generation-error"},
        )
