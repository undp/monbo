import json
from typing import Literal, cast

from fastapi import HTTPException
from shapely import wkt
from shapely.geometry import Point as ShapelyPoint
from shapely.geometry import Polygon as ShapelyPolygon

from app.helpers.GeometryCalculator import GeometryCalculator
from app.models.farms import (
    FarmData,
    FarmPolygonDetailData,
    PolygonSummary,
    PreProcessedFarmData,
)
from app.models.polygons import Coordinates, PointDetails, PolygonDetails
from app.utils.polygons import (
    generate_polygon,
    get_point_area_and_radius,
)


def get_farm_coords_and_radius(
    farm: FarmPolygonDetailData,
) -> tuple[list[Coordinates], float | None]:
    """
    Derives the (coords, radius) pair used to build a farm's polygon from its
    ``type`` + ``details``. ``type`` and ``details`` are independent,
    client-controlled fields (not a discriminated union), so a mismatch between
    them is rejected here instead of being asserted or silently coerced.
    """
    details = farm.details
    if farm.type == "polygon" and isinstance(details, PolygonDetails):
        return details.path, None
    if farm.type == "point" and isinstance(details, PointDetails):
        return [details.center], details.radius
    raise ValueError(f"Details do not match farm type '{farm.type}'")


def parse_farm_coordinates_string(
    coordinates_format: str,
    geometry_type: Literal["Point", "Polygon"],
    farm_coordinates: str,
) -> list[Coordinates]:
    """
    Parses a string of farm coordinates into a list of Coordinates objects.

    Args:
        geometry_type (str): The type of geometry to parse the coordinates from
        farm_coordinates (str): A string representing farm coordinates in WKT or
        GeoJSON format. The coordinates should be in decimal degrees with longitude
        first, then latitude.

    Returns:
        list[Coordinates]: A list of Coordinates objects with longitude (lng) and
        latitude (lat) attributes representing the coordinates.

    Raises:
        ValueError: If the geometry_type is not supported or coordinates
                   cannot be parsed or are empty.

    Examples:
        coordinates_format = "WKT"
        geometry_type = "Point"
        farm_coordinates = "POINT (1.0 2.0)"
        coords = parse_farm_coordinates_string(
            coordinates_format,
            geometry_type,
            farm_coordinates
        )
        # coords will be [Coordinates(lng=1.0, lat=2.0)]

        coordinates_format = "GeoJSON"
        geometry_type = "Point"
        farm_coordinates = "[1.0, 2.0]"
        coords = parse_farm_coordinates_string(
            coordinates_format,
            geometry_type,
            farm_coordinates
        )
        # coords will be [Coordinates(lng=1.0, lat=2.0)]

        coordinates_format = "GeoJSON"
        geometry_type = "Polygon"
        farm_coordinates = "[[[1.0, 2.0], [3.0, 4.0], [5.0, 6.0], [1.0, 2.0]]]"
        coords = parse_farm_coordinates_string(
            coordinates_format,
            geometry_type,
            farm_coordinates
        )
        # coords will be [Coordinates(lng=1.0, lat=2.0),
        #                 Coordinates(lng=3.0, lat=4.0), ...]
    """
    if not farm_coordinates.strip():
        raise ValueError("Farm coordinates cannot be empty")

    try:
        if coordinates_format == "WKT":
            return _parse_wkt_coordinates(geometry_type, farm_coordinates)
        elif coordinates_format == "GeoJSON":
            if geometry_type == "Point":
                return _parse_geojson_point_coordinates(farm_coordinates)
            elif geometry_type == "Polygon":
                return _parse_geojson_polygon_coordinates(farm_coordinates)
            else:
                raise ValueError(f"Unsupported geometry type: {geometry_type}")
        else:
            raise ValueError(f"Unsupported coordinates format: {coordinates_format}")
    except Exception as e:
        raise ValueError(f"Error parsing coordinates: {str(e)}") from e


def _parse_wkt_coordinates(
    geometry_type: Literal["Point", "Polygon"], farm_coordinates: str
) -> list[Coordinates]:
    """
    Parses WKT format coordinates. Only supports Point and Polygon geometries.

    Args:
        farm_coordinates (str): WKT format string (e.g., "POINT (1.0 2.0)",
                               "POLYGON ((1.0 2.0, 3.0 4.0, 5.0 6.0, 1.0 2.0))")

    Returns:
        list[Coordinates]: List of coordinate objects
    """
    geom = wkt.loads(farm_coordinates)
    if geometry_type == "Point":
        if not isinstance(geom, ShapelyPoint):
            raise ValueError("Inconsistent geometry_type and WKT coordinates")
        return [Coordinates(lng=float(geom.x), lat=float(geom.y))]
    if geometry_type == "Polygon":
        if not isinstance(geom, ShapelyPolygon):
            raise ValueError("Inconsistent geometry_type and WKT coordinates")
        return [
            Coordinates(lng=float(x), lat=float(y)) for x, y in geom.exterior.coords
        ]
    raise ValueError("Unsupported geometry type")


def _parse_geojson_point_coordinates(farm_coordinates: str) -> list[Coordinates]:
    """
    Parses GeoJSON Point format coordinates.

    Args:
        farm_coordinates (str): GeoJSON Point format string (e.g., "[1.0, 2.0]")

    Returns:
        list[Coordinates]: List containing single coordinate object
    """
    try:
        coords = json.loads(farm_coordinates)
        if not isinstance(coords, list) or len(coords) != 2:
            raise ValueError("GeoJSON Point must be an array with exactly 2 elements")

        lng, lat = coords
        return [Coordinates(lng=float(lng), lat=float(lat))]
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        raise ValueError(f"Invalid GeoJSON Point coordinates: {e}")


def _parse_geojson_polygon_coordinates(farm_coordinates: str) -> list[Coordinates]:
    """
    Parses GeoJSON Polygon format coordinates.

    Args:
        farm_coordinates (str): GeoJSON Polygon format string
                               (e.g., "[[[1.0, 2.0], [3.0, 4.0],
                               [5.0, 6.0], [1.0, 2.0]]]")

    Returns:
        list[Coordinates]: List of coordinate objects from all linear rings
    """
    try:
        rings = json.loads(farm_coordinates)
        if not isinstance(rings, list) or len(rings) == 0:
            raise ValueError("GeoJSON Polygon must be an array of linear rings")

        coordinates = []
        for ring in rings:
            if not isinstance(ring, list):
                raise ValueError("Each ring in GeoJSON Polygon must be an array")

            for coord in ring:
                if not isinstance(coord, list) or len(coord) != 2:
                    raise ValueError(
                        "Each coordinate must be an array with exactly 2 elements"
                    )
                lng, lat = coord
                coordinates.append(Coordinates(lng=float(lng), lat=float(lat)))

        return coordinates
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        raise ValueError(f"Invalid GeoJSON Polygon coordinates: {e}")


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
        poly_type = farm.geometryType.lower()  # Use the geometryType attribute
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
            type=cast(Literal["polygon", "point"], poly_type),
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
