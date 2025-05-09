from app.models.farms import PreProcessedFarmData, FarmData, PolygonSummary
from app.models.polygons import Coordinates, PolygonDetails, PointDetails
from app.helpers.GeometryCalculator import GeometryCalculator
from app.utils.polygons import (
    determine_polygon_type,
    generate_polygon,
    get_point_area_and_radius,
)
from fastapi import HTTPException
import re


def parse_farm_coordinates_string(farm_coordinates: str) -> list[Coordinates]:
    """
    Parses a string of farm coordinates into a list of Coordinates objects.

    Args:
        farm_coordinates (str): A string representing farm coordinates in the format
        "[ (lon, lat), (lon, lat), ... ]". The coordinates should be in decimal
        degrees with longitude first, then latitude.

    Returns:
        list[Coordinates]: A list of Coordinates objects with longitude (lng) and
        latitude (lat) attributes representing the coordinates. Returns an empty
        list if the input string is empty.

    Example:
        farm_coordinates = "[ (1.0, 2.0), (3.0, 4.0) ]"
        coords = parse_farm_coordinates_string(farm_coordinates)
        # coords will be [Coordinates(lng=1.0, lat=2.0), Coordinates(lng=3.0, lat=4.0)]
    """
    pattern = r"\(([^,]+),\s*([^)]+)\)"

    matches = re.findall(pattern, farm_coordinates)

    return [Coordinates(lng=float(lng), lat=float(lat)) for lng, lat in matches]


def parse_base_information(farm: PreProcessedFarmData) -> FarmData:
    """
    Parses the base information of a farm and generates polygon details.

    Args:
        farm (PreProcessedFarmData): The unprocessed farm data containing farm details
        and coordinates.

    Returns:
        FarmData: A FarmData object containing the parsed base information and polygon
                details. The polygon field will contain type, details
                (center/path/radius) and area.

    Raises:
        HTTPException: If there is an error parsing the farm coordinates or generating
                      the polygon. Returns a 400 status code with error details.
    """
    base_information = FarmData(
        id=farm.id,
        producer=farm.producerName,
        producerId="",
        cropType=farm.cropType,
        productionDate=farm.productionDate,
        production=farm.productionQuantity,
        productionQuantityUnit=farm.productionQuantityUnit,
        country=farm.country,
        region=farm.region,
        association=farm.association,
        documents=farm.documents,
        polygon=None,
    )
    try:
        poly_type = determine_polygon_type(farm.farmCoordinates)
        details: PolygonDetails | PointDetails | None = None
        area = None

        if poly_type == "polygon":
            polygon = generate_polygon(farm.farmCoordinates)
            if not polygon.is_empty:
                details = PolygonDetails(
                    center=Coordinates(
                        lng=polygon.centroid.x,
                        lat=polygon.centroid.y,
                    ),
                    path=farm.farmCoordinates,
                )
                area = GeometryCalculator.calculate_polygon_area(polygon)
        elif poly_type == "point":
            area, radius = get_point_area_and_radius(float(farm.area))
            polygon = generate_polygon(farm.farmCoordinates, radius)
            details = PointDetails(
                center=Coordinates(
                    lng=farm.farmCoordinates[0].lng,
                    lat=farm.farmCoordinates[0].lat,
                ),
                radius=radius,
            )

        base_information.polygon = PolygonSummary(
            type=poly_type,
            details=details,
            area=area,
        )
        return base_information

    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=400,
            detail={
                "id": farm.id,
                "error": "polygon-generation-error",
                "message": str(e),
            },
        )
