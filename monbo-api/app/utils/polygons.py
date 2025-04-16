from app.models.polygons import Coordinates, Point
from pyproj import CRS, Transformer
from shapely.geometry import Point as SPoint
from shapely.geometry import Polygon
from shapely.ops import transform

POINT_RADIUS = 0.0009


def generate_polygon(points: list[Point]) -> Polygon:
    """
    Generates a polygon or a buffered point from a list of points.

    If the list contains only one point, it returns a buffered point with a
    small radius.
    If the list contains multiple points, it returns a polygon created from
    those points.

    Args:
        points (list[Point]): A list of Point objects representing the vertices of
        the polygon.

    Returns:
        tuple: A tuple where the first element is a string indicating the type
        ('point' or 'polygon'), and the second element is the corresponding
        Shapely geometry object (buffered point or polygon).
    """
    if len(points) == 1:
        point = SPoint(points[0].x, points[0].y)
        return ("point", point.buffer(POINT_RADIUS))
    points = [(point.x, point.y) for point in points]
    return ("polygon", Polygon(points))


def generate_polygon_from_coordinates(
    coordinates: list[Coordinates],
) -> tuple[str, Polygon]:
    """
    Generates a polygon or a buffered point from a list of coordinates.

    If the list contains only one coordinate, it returns a buffered point with a
    small radius.
    If the list contains multiple coordinates, it returns a polygon created from those
    coordinates.

    Args:
        coordinates (list[Coordinates]): A list of Coordinates objects representing
        the vertices of the polygon.

    Returns:
        tuple: A tuple where the first element is a string indicating the type
        ('point' or 'polygon'), and the second element is the corresponding Shapely
        geometry object (buffered point or polygon).
    """
    if len(coordinates) == 1:
        point = SPoint(coordinates[0].lng, coordinates[0].lat)
        return ("point", point.buffer(POINT_RADIUS))
    points = [(coord.lng, coord.lat) for coord in coordinates]
    return ("polygon", Polygon(points))


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
