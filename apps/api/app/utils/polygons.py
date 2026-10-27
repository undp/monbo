import math
from typing import Literal, Tuple, TypeAlias

from shapely.geometry import LinearRing, MultiPolygon, Polygon
from shapely.geometry import Point as SPoint
from shapely.geometry.polygon import orient

from app.models.polygons import Coordinates, PolygonPart
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
        # radius is guaranteed non-None here by the validation above.
        assert radius is not None
        point = SPoint(coordinates[0].lng, coordinates[0].lat)
        radius_degrees, _ = GeoHelper.meters_to_degrees(radius, coordinates[0].lat)
        return point.buffer(radius_degrees)

    if len(coordinates) == 2:
        points = [(coord.lng, coord.lat) for coord in coordinates + coordinates[:1]]
        return Polygon(points)

    polygon = parts_to_geometry([PolygonPart(exterior=coordinates, holes=[])])
    assert isinstance(polygon, Polygon)
    return polygon


# A farm's polygon geometry: a Polygon, or a MultiPolygon when the farm has several
# parts. The functions below are the only crossing between it and `PolygonPart`s.
FarmGeometry: TypeAlias = Polygon | MultiPolygon


def _ring_points(ring: list[Coordinates]) -> list[tuple[float, float]]:
    return [(coord.lng, coord.lat) for coord in ring]


def parts_to_geometry(parts: list[PolygonPart]) -> FarmGeometry:
    """
    The Shapely geometry of a farm's parts: a Polygon for one part (or an empty
    Polygon for none) and a MultiPolygon for several, with every hole.

    Raises:
        ValueError: If a ring has too few vertices to be built (1 or 2).
    """
    polygons = [
        Polygon(_ring_points(part.exterior), [_ring_points(h) for h in part.holes])
        for part in parts
        if part.exterior
    ]
    if not polygons:
        return Polygon()
    if len(polygons) == 1:
        return polygons[0]
    return MultiPolygon(polygons)


def _ring_coordinates(ring: LinearRing) -> list[Coordinates]:
    return [Coordinates(lng=x, lat=y) for x, y, *_ in ring.coords]


def geometry_to_parts(geometry: FarmGeometry) -> list[PolygonPart]:
    """
    A Polygon's or MultiPolygon's parts, each with its holes. The exterior is
    oriented counter-clockwise and the holes clockwise: Google Maps draws a hole only
    when it winds opposite to its exterior.
    """
    polygons = geometry.geoms if isinstance(geometry, MultiPolygon) else [geometry]
    parts = []
    for polygon in polygons:
        if polygon.is_empty:
            continue
        oriented = orient(polygon, sign=1.0)
        parts.append(
            PolygonPart(
                exterior=_ring_coordinates(oriented.exterior),
                holes=[_ring_coordinates(hole) for hole in oriented.interiors],
            )
        )
    return parts


def farm_center(geometry: FarmGeometry) -> Coordinates:
    """
    A point inside the farm. Its centroid when that lies inside it, as for any
    convex farm; otherwise (a hole over the centroid, or parts apart) a point that
    Shapely guarantees inside it.
    """
    centroid = geometry.centroid
    point = centroid if geometry.contains(centroid) else geometry.representative_point()
    return Coordinates(lng=point.x, lat=point.y)


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
