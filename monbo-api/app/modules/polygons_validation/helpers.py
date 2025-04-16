from typing import List

from app.models.polygons import Point
from shapely import STRtree
from shapely.geometry import Point as SPoint
from shapely.geometry import Polygon


def generate_polygon(points: list[Point]) -> Polygon:
    """
    Generates a polygon or a buffered point from a list of points.

    If the list contains only one point, it returns a buffered point with
    a small radius.
    If the list contains multiple points, it returns a polygon created from
    those points.

    Args:
        points (list[Point]): A list of Point objects representing the
        vertices of the polygon.

    Returns:
        tuple: A tuple where the first element is a string indicating the type
        ('point' or 'polygon') and the second element is the corresponding Shapely
        geometry object (buffered point or polygon).
    """
    if len(points) == 1:
        point = SPoint(points[0].x, points[0].y)
        return ("point", point.buffer(0.0009))
    points = [(point.x, point.y) for point in points]
    return ("polygon", Polygon(points))


def check_polygons_overlap(polygons: List[Polygon]):
    """
    Check for overlapping polygons and return the intersections.
    This function takes a list of polygons and checks for any overlaps between them.
    If overlaps are found, it returns a list of dictionaries containing the intersection
    polygons and the indices of the overlapping polygons.
    Args:
        polygons (List[Polygon]): A list of Polygon objects to check for overlaps.
    Returns:
        List[Dict[str, Union[Polygon, int]]]: A list of dictionaries, each containing:
            - "intersection_polygon" (Polygon): The polygon representing the
            intersection.
            - "polygon1_idx" (int): The index of the first polygon in the overlap.
            - "polygon2_idx" (int): The index of the second polygon in the overlap.
    """
    tree = STRtree(polygons)

    overlaps = []
    polygons_intersections_index = []

    for i in range(0, len(polygons)):
        for idx in tree.query(polygons[i]):
            if idx != i and f"{idx}-{i}" not in polygons_intersections_index:
                if polygons[i].intersects(polygons[idx]):
                    polygons_intersections_index.append(f"{i}-{idx}")
                    overlaps.append(
                        {
                            "intersection_polygon": polygons[i].intersection(
                                polygons[idx]
                            ),
                            "polygon1_idx": i,
                            "polygon2_idx": int(idx),
                        }
                    )

    return overlaps


def get_polygon_coordinates(polygon: Polygon) -> list[Point]:
    """
    Extracts the coordinates from the exterior of a given polygon and returns
    them as a list of points.

    Args:
        polygon (Polygon): A Shapely Polygon object from which to extract
        the coordinates.

    Returns:
        list[Point]: A list of dictionaries, each containing the longitude ('lng')
        and latitude ('lat') of a point.
    """
    return [
        {"lng": point[0], "lat": point[1]} for point in list(polygon.exterior.coords)
    ]
