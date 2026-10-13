from typing import List

from shapely import STRtree
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.validation import explain_validity

from app.config.env import OVERLAP_THRESHOLD_PERCENTAGE
from app.helpers.GeometryCalculator import GeometryCalculator
from app.models.farms import FarmPolygonDetailDataWithPolygon


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
            if idx == i or f"{idx}-{i}" in polygons_intersections_index:
                continue
            if not polygons[i].is_valid or not polygons[idx].is_valid:
                continue

            if polygons[i].intersects(polygons[idx]):
                polygons_intersections_index.append(f"{i}-{idx}")
                overlaps.append(
                    {
                        "intersection_polygon": polygons[i].intersection(polygons[idx]),
                        "polygon1_idx": i,
                        "polygon2_idx": int(idx),
                    }
                )

    return overlaps


def get_geometry_paths(geometry: BaseGeometry) -> list[list[dict]]:
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


def polygonal_part(geometry: BaseGeometry) -> Polygon | MultiPolygon:
    """
    The part of an intersection that has an area. Two farms that overlap and also
    touch elsewhere intersect in a GeometryCollection of polygons and lines; farms
    that only touch intersect in a line or a point, which has no polygonal part.
    """
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry
    polygons: list[Polygon] = []
    for part in getattr(geometry, "geoms", []):
        if isinstance(part, Polygon):
            polygons.append(part)
        elif isinstance(part, MultiPolygon):
            polygons.extend(part.geoms)
    if len(polygons) == 1:
        return polygons[0]
    return MultiPolygon(polygons) if polygons else Polygon()


def get_overlap_ratio(
    overlap_area: float, polygon1_area: float, polygon2_area: float
) -> float:
    """
    The share of the smaller farm covered by the overlap, capped at 1. A farm
    inside another scores 1, however large the other one is.
    """
    smaller_area = min(polygon1_area, polygon2_area)
    if overlap_area <= 0 or smaller_area <= 0:
        return 0.0
    return min(1.0, overlap_area / smaller_area)


def is_overlap_above_threshold(overlap_ratio: float) -> bool:
    return 100 * overlap_ratio > OVERLAP_THRESHOLD_PERCENTAGE


def get_overlap_criticality(overlap_ratio: float) -> str:
    return "HIGH" if overlap_ratio > 0.8 else "MEDIUM"


def get_overlap_inconsistencies(farms: list[FarmPolygonDetailDataWithPolygon]):
    polygons = list(map(lambda x: x.polygon, farms))

    overlaps = detect_overlaps(polygons)

    inconsistencies = []
    for overlap in overlaps:
        intersection = polygonal_part(overlap["intersection_polygon"])
        overlap_area = GeometryCalculator.calculate_polygon_area(intersection)
        # Shared edges and vertices aren't overlaps
        if overlap_area <= 0:
            continue

        overlap_ratio = get_overlap_ratio(
            overlap_area,
            GeometryCalculator.calculate_polygon_area(
                polygons[overlap["polygon1_idx"]]
            ),
            GeometryCalculator.calculate_polygon_area(
                polygons[overlap["polygon2_idx"]]
            ),
        )

        if is_overlap_above_threshold(overlap_ratio):
            inconsistencies.append(
                {
                    "type": "overlap",
                    "farmIds": [
                        farms[overlap["polygon1_idx"]].id,
                        farms[overlap["polygon2_idx"]].id,
                    ],
                    "data": {
                        "percentage": overlap_ratio,
                        "criticality": get_overlap_criticality(overlap_ratio),
                        "area": overlap_area,
                        "center": {
                            "lng": intersection.centroid.x,
                            "lat": intersection.centroid.y,
                        },
                        "paths": get_geometry_paths(intersection),
                    },
                }
            )
    return inconsistencies


def get_geometry_inconsistencies(farms: list[FarmPolygonDetailDataWithPolygon]):
    """
    Check for other types of polygon inconsistencies:
    - Invalid polygons (not valid geometry)

    Args:
        farms (list[FarmWithPolygon]): List of farms with polygon data

    Returns:
        list: List of inconsistency dictionaries for other types of issues
    """
    inconsistencies: list[dict] = []

    for farm in farms:
        polygon: BaseGeometry = farm.polygon

        # Check if the polygon is empty
        if polygon.is_empty:
            inconsistencies.append(
                {
                    "type": "empty_polygon",
                    "farmIds": [farm.id],
                    "data": None,
                }
            )

        # Check for invalid geometry
        if not polygon.is_valid:
            inconsistencies.append(
                {
                    "type": "invalid_geometry",
                    "farmIds": [farm.id],
                    "data": {
                        "reason": explain_validity(polygon),
                    },
                }
            )

    return inconsistencies
