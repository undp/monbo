import random
import string
from typing import List

from app.models.polygons import Point
from shapely import STRtree
from shapely.geometry.base import BaseGeometry
from shapely.geometry import Point as SPoint, Polygon


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


def ensure_farm_ids(farms_data, original_farms):
    """
    Ensures all farms have appropriate IDs based on existing data patterns.

    Args:
        farms_data (list): List of processed farm data (dictionaries)
        original_farms (list): List of original farm objects

    Returns:
        list: The updated farm data with IDs assigned where needed
    """
    # Check if any farms have IDs
    farms_with_id = [
        farm for farm in original_farms if hasattr(farm, "id") and bool(farm.id)
    ]
    all_have_ids = len(farms_with_id) == len(original_farms)
    none_have_ids = len(farms_with_id) == 0

    if all_have_ids:
        # All farms have IDs, no action needed
        return farms_data

    # Generate a set of existing IDs to avoid duplicates
    existing_ids = {str(farm.id) for farm in farms_with_id}

    # Assign IDs to farms that need them
    for i, (farm_data, original_farm) in enumerate(zip(farms_data, original_farms)):
        if none_have_ids:
            # If none have IDs, assign sequential numbers
            farm_data["id"] = str(i + 1)
        elif not hasattr(original_farm, "id") or not bool(original_farm.id):
            # If some have IDs but this one doesn't
            # Generate a short alphanumeric ID (6 characters)
            while True:
                short_id = "".join(
                    random.choices(string.ascii_uppercase + string.digits, k=6)
                )
                if short_id not in existing_ids:
                    break
            farm_data["id"] = short_id
            existing_ids.add(short_id)

    return farms_data


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


def get_geometry_paths(geometry: BaseGeometry) -> list[list[Point]]:
    """
    Extracts the coordinates from the exterior of a given polygon or multipolygon
    and returns them as a list of paths, where each path is a list of points.

    Args:
        polygon (Polygon or MultiPolygon): A Shapely Polygon or MultiPolygon object
        from which to extract the coordinates.

    Returns:
        list[list[Point]]: A list of paths, each path is a list of dictionaries,
        each containing the longitude ('lng') and latitude ('lat') of a point.
    """
    if geometry.geom_type == "MultiPolygon":
        return [
            [{"lng": point[0], "lat": point[1]} for point in list(poly.exterior.coords)]
            for poly in geometry.geoms
        ]
    if geometry.geom_type == "Polygon":
        return [
            [
                {"lng": point[0], "lat": point[1]}
                for point in list(geometry.exterior.coords)
            ]
        ]

    raise ValueError(f"Unsupported geometry type: {geometry.geom_type}")
