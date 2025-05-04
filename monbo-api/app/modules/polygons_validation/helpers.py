from typing import List

from app.models.polygons import Point
from shapely import STRtree
from shapely.geometry.base import BaseGeometry
from shapely.geometry import Polygon
from app.utils.polygons import get_polygon_area
from app.config.env import OVERLAP_THRESHOLD_PERCENTAGE
from app.models.farms import FarmWithPolygon
from shapely.validation import explain_validity


def detect_overlaps(polygons: List[Polygon]):
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


def get_overlap_inconsistencies(farms: list[FarmWithPolygon]):
    polygons = list(map(lambda x: x["polygon"], farms))

    overlaps = detect_overlaps(polygons)

    inconsistencies = []
    for overlap in overlaps:
        overlap_area = get_polygon_area(overlap["intersection_polygon"])

        overlap_farms_ids = [
            farms[overlap["polygon1_idx"]]["id"],
            farms[overlap["polygon2_idx"]]["id"],
        ]

        overlap_polygons = [
            polygons[overlap["polygon1_idx"]],
            polygons[overlap["polygon2_idx"]],
        ]
        overlap_polygons_area = sum(list(map(get_polygon_area, overlap_polygons)))

        # Calculate the union area (total area minus the double-counted overlap)
        union_area = overlap_polygons_area - overlap_area

        # Handle the case where polygons are identical or nearly identical
        # Using a small epsilon for floating point comparison
        if abs(overlap_area - union_area) < 1e-10:
            overlap_ratio = 1.0  # 100% overlap
        else:
            overlap_ratio = min(1.0, overlap_area / union_area)  # Cap at 100%

        if 100 * overlap_ratio > OVERLAP_THRESHOLD_PERCENTAGE:
            inconsistencies.append(
                {
                    "type": "overlap",
                    "farmIds": overlap_farms_ids,
                    "data": {
                        "percentage": overlap_ratio,
                        "criticality": "HIGH" if overlap_ratio > 0.8 else "MEDIUM",
                        "area": overlap_area,
                        "center": {
                            "lng": overlap["intersection_polygon"].centroid.x,
                            "lat": overlap["intersection_polygon"].centroid.y,
                        },
                        "paths": get_geometry_paths(overlap["intersection_polygon"]),
                    },
                }
            )
    return inconsistencies


def get_geometry_inconsistencies(farms: list[FarmWithPolygon]):
    """
    Check for other types of polygon inconsistencies:
    - Invalid polygons (not valid geometry)

    Args:
        farms (list[FarmWithPolygon]): List of farms with polygon data

    Returns:
        list: List of inconsistency dictionaries for other types of issues
    """
    inconsistencies = []

    for farm in farms:
        polygon: BaseGeometry = farm["polygon"]

        # Check if the polygon is empty
        if polygon.is_empty:
            inconsistencies.append(
                {
                    "type": "empty_polygon",
                    "farmIds": [farm["id"]],
                    "data": None,
                }
            )

        # Check for invalid geometry
        if not polygon.is_valid:
            inconsistencies.append(
                {
                    "type": "invalid_geometry",
                    "farmIds": [farm["id"]],
                    "data": {
                        "reason": explain_validity(polygon),
                    },
                }
            )

    return inconsistencies
