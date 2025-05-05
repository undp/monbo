import math
from typing import Tuple, Literal
from app.models.polygons import Coordinates
from pyproj import CRS, Transformer
from shapely.geometry import Point as SPoint, Polygon
from shapely.ops import transform
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


def get_polygon_area(polygon: Polygon) -> float:
    """
    Calculate the area of a given polygon.

    This function transforms the given polygon's coordinates from the WGS 84
    coordinate system (EPSG:4326) to an Albers Equal-Area projection, which
    is defined using the polygon's bounding box. It then calculates the area
    of the transformed polygon and returns it rounded to two decimal places.

    Args:
        polygon (Polygon): The polygon for which the area is to be calculated.

    Returns:
        float: The area of the polygon in square meters, rounded to two decimal places.
    """
    # Define an Albers Equal-Area projection using the polygon's bounding box
    lon_min, lat_min, lon_max, lat_max = polygon.bounds
    crs_albers = CRS.from_proj4(
        f"+proj=aea +lat_1={lat_min} +lat_2={lat_max} "
        f"+lon_0={(lon_min + lon_max) / 2} +lat_0={(lat_min + lat_max) / 2}"
    )

    # Create a transformer from WGS 84 to the Albers projection
    transformer = Transformer.from_crs(CRS("EPSG:4326"), crs_albers, always_xy=True)

    # Transform the polygon to the projected coordinate system
    projected_polygon = transform(transformer.transform, polygon)

    # Return the area rounded to two decimal places
    return round(projected_polygon.area, 2)


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
