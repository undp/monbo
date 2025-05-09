import math
from typing import Tuple, Literal
from app.models.polygons import Coordinates
from shapely.geometry import Point as SPoint, Polygon
from app.utils.image_generation.GeoHelper import GeoHelper


def determine_polygon_type(
    coordinates: list[Coordinates],
) -> Literal["polygon", "point"]:
    """
    Determines whether a list of coordinates represents a point or a polygon.

    Args:
        coordinates (list[Coordinates]): A list of Coordinates objects representing
            the vertices of a shape.

    Returns:
        Literal["polygon", "point"]: Returns "point" if the list contains exactly
            one coordinate, otherwise returns "polygon".

    Example:
        >>> coords = [Coordinates(lng=1.0, lat=2.0)]
        >>> determine_polygon_type(coords)
        'point'
        >>> coords = [Coordinates(lng=1.0, lat=2.0), Coordinates(lng=3.0, lat=4.0)]
        >>> determine_polygon_type(coords)
        'polygon'
    """
    return "point" if len(coordinates) == 1 else "polygon"


def generate_polygon(
    coordinates: list[Coordinates],
    radius: float | None = None,
) -> Polygon:
    """
    Generates a polygon from a list of coordinates, or a circular buffer around
    a single point.

    Args:
        coordinates (list[Coordinates]): A list of coordinates. For a polygon, this
        should be multiple coordinates defining the vertices. For a point, this should
        be a single coordinate.
        radius (float | None, optional): For point geometries, the radius in meters to
        create the circular buffer. Required when coordinates contains exactly one
        point, and must be None otherwise. Defaults to None.

    Returns:
        Polygon: A Shapely Polygon object. For multiple coordinates, this will be
            a polygon with vertices at the given coordinates. For a single coordinate
            with radius, this will be a circular polygon centered on that point.

    Raises:
        ValueError: If radius is provided with multiple coordinates, or if radius is not
            provided with a single coordinate.

    Example:
        # Create a triangular polygon
        coords = [
            Coordinates(lng=0, lat=0),
            Coordinates(lng=1, lat=0),
            Coordinates(lng=0, lat=1)
        ]
        triangle = generate_polygon(coords)

        # Create a circular buffer around a point
        point = [Coordinates(lng=0, lat=0)]
        circle = generate_polygon(point, radius=100)
    """
    if radius is not None and len(coordinates) != 1:
        raise ValueError("Radius can only be used with a single coordinate")

    if radius is None and len(coordinates) == 1:
        raise ValueError("Radius must be provided when generating a point")

    if not coordinates:
        return Polygon([])

    if len(coordinates) == 1:
        point = SPoint(coordinates[0].lng, coordinates[0].lat)
        (radius_degrees, _) = GeoHelper.meters_to_degrees(radius, coordinates[0].lat)
        return point.buffer(radius_degrees)

    if len(coordinates) == 2:
        points = [(coord.lng, coord.lat) for coord in coordinates + coordinates[:1]]
        return Polygon(points)

    points = [(coord.lng, coord.lat) for coord in coordinates]
    return Polygon(points)


def get_point_area_and_radius(area: float) -> Tuple[float, float]:
    """
    Calculate the area and radius of a point, assuming a circular shape.

    Args:
        area (float): The area in hectares.

    Returns:
        Tuple[float, float]: A tuple containing:
            - The area in square meters (m²)
            - The radius in meters (m) calculated from the area
    """
    area *= 10000  # Convert hectares to square meters
    return area, round(math.sqrt(area / math.pi), 2)
