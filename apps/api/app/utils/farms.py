import json
from typing import Literal

import shapely
from fastapi import HTTPException
from shapely import wkt
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry import Point as ShapelyPoint
from shapely.geometry.base import BaseGeometry

from app.helpers.GeometryCalculator import GeometryCalculator
from app.models.farms import (
    FarmData,
    FarmPolygonDetailData,
    PointSummary,
    PolygonShapeSummary,
    PreProcessedFarmData,
)
from app.models.polygons import Coordinates, PointDetails, PolygonDetails
from app.utils.polygons import (
    FarmGeometry,
    farm_center,
    generate_polygon,
    geometry_to_parts,
    get_point_area_and_radius,
    parts_to_geometry,
)

GeometryType = Literal["Point", "Polygon", "MultiPolygon"]


class FarmDetailsMismatchError(ValueError):
    """A farm's `type` and `details` disagree: a malformed request, not a bad
    geometry."""


def build_farm_geometry(farm: FarmPolygonDetailData) -> FarmGeometry:
    """
    The Shapely geometry of a farm as the web sends it back: its parts with their
    holes for a polygon, or the circle of its radius for a point. ``type`` and
    ``details`` are independent, client-controlled fields (not a discriminated
    union), so a mismatch between them is rejected instead of being asserted or
    silently coerced.

    Raises:
        FarmDetailsMismatchError: If ``details`` doesn't match ``type``.
        ValueError: If the geometry can't be built (a ring of 1 or 2 vertices).
    """
    details = farm.details
    if farm.type == "polygon" and isinstance(details, PolygonDetails):
        return parts_to_geometry(details.parts)
    if farm.type == "point" and isinstance(details, PointDetails):
        return generate_polygon([details.center], details.radius)
    raise FarmDetailsMismatchError(f"Details do not match farm type '{farm.type}'")


def parse_farm_coordinates_string(
    coordinates_format: str,
    geometry_type: GeometryType,
    farm_coordinates: str,
) -> ShapelyPoint | Polygon | MultiPolygon:
    """
    Parses a farm's coordinates, in WKT or as a GeoJSON coordinates array, into a
    2D Shapely geometry: a Point, or a Polygon or MultiPolygon with its holes.

    The geometry's type comes from the coordinates (the WKT keyword, or the GeoJSON
    array's depth). ``geometry_type`` only has to agree on point vs polygon:
    "Polygon" and "MultiPolygon" are interchangeable, so a farm of several parts
    declared as "Polygon" is accepted.

    Examples:
        parse_farm_coordinates_string("WKT", "Point", "POINT (1.0 2.0)")
        # Point(1, 2)
        parse_farm_coordinates_string("GeoJSON", "Point", "[1.0, 2.0]")
        # Point(1, 2)
        parse_farm_coordinates_string(
            "GeoJSON", "Polygon", "[[[0, 0], [1, 0], [1, 1], [0, 0]], [[...hole]]]"
        )
        # Polygon with one hole

    Raises:
        ValueError: If the coordinates are empty, can't be parsed, aren't a point,
            polygon or multipolygon, or disagree with ``geometry_type``.
    """
    if not farm_coordinates.strip():
        raise ValueError("Farm coordinates cannot be empty")

    try:
        geometry: BaseGeometry
        if coordinates_format == "WKT":
            geometry = wkt.loads(farm_coordinates)
        elif coordinates_format == "GeoJSON":
            geometry = _parse_geojson_coordinates(farm_coordinates)
        else:
            raise ValueError(f"Unsupported coordinates format: {coordinates_format}")
        return _check_geometry_type(geometry_type, geometry)
    except Exception as e:
        raise ValueError(f"Error parsing coordinates: {str(e)}") from e


def _check_geometry_type(
    geometry_type: GeometryType, geometry: BaseGeometry
) -> ShapelyPoint | Polygon | MultiPolygon:
    if not isinstance(geometry, (ShapelyPoint, Polygon, MultiPolygon)):
        raise ValueError(f"Unsupported geometry type: {geometry.geom_type}")
    if isinstance(geometry, ShapelyPoint) != (geometry_type == "Point"):
        raise ValueError(
            f"Inconsistent geometry type '{geometry_type}' and "
            f"{geometry.geom_type} coordinates"
        )
    return shapely.force_2d(geometry)


def _parse_geojson_coordinates(
    farm_coordinates: str,
) -> ShapelyPoint | Polygon | MultiPolygon:
    """
    A GeoJSON coordinates array, by its depth: ``[lng, lat]`` is a Point,
    ``[ring, ...]`` a Polygon (its first ring the exterior, the rest holes) and
    ``[polygon, ...]`` a MultiPolygon.
    """
    try:
        coordinates = json.loads(farm_coordinates)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid GeoJSON coordinates: {e}") from e

    depth = _nesting_depth(coordinates)
    if depth == 1:
        return ShapelyPoint(_position(coordinates))
    if depth == 3:
        return _geojson_polygon(coordinates)
    if depth == 4:
        return MultiPolygon([_geojson_polygon(polygon) for polygon in coordinates])
    raise ValueError(
        "GeoJSON coordinates must be a Point, Polygon or MultiPolygon array"
    )


def _nesting_depth(value: object) -> int:
    depth = 0
    while isinstance(value, list):
        if not value:
            raise ValueError("GeoJSON coordinates contain an empty array")
        depth += 1
        value = value[0]
    return depth


def _position(value: object) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError("Each coordinate must be an array with exactly 2 elements")
    lng, lat = value
    return float(lng), float(lat)


def _geojson_polygon(rings: object) -> Polygon:
    if not isinstance(rings, list) or len(rings) == 0:
        raise ValueError("A GeoJSON polygon must be an array of linear rings")
    parsed = []
    for ring in rings:
        if not isinstance(ring, list):
            raise ValueError("Each ring in a GeoJSON polygon must be an array")
        parsed.append([_position(coordinate) for coordinate in ring])
    exterior, *holes = parsed
    return Polygon(exterior, holes)


def parse_base_information(farm: PreProcessedFarmData) -> FarmData:
    """
    Parses the base information of a farm and generates polygon details.

    Args:
        farm (PreProcessedFarmData): The unprocessed farm data containing farm details
        and its parsed geometry.

    Returns:
        FarmData: A FarmData object containing the parsed base information and polygon
                details. The polygon field will contain type, details
                (center and parts, or center and radius) and area.

    Raises:
        HTTPException: If there is an error generating the polygon. Returns a 400
                      status code with error details.
    """
    summary: PointSummary | PolygonShapeSummary
    try:
        geometry = farm.farmCoordinates
        if isinstance(geometry, ShapelyPoint):
            area, radius = get_point_area_and_radius(float(farm.area))
            summary = PointSummary(
                type="point",
                details=PointDetails(
                    center=Coordinates(lng=geometry.x, lat=geometry.y),
                    radius=radius,
                ),
                area=area,
            )
        else:
            details = None
            polygon_area = None
            if not geometry.is_empty:
                details = PolygonDetails(
                    center=farm_center(geometry),
                    parts=geometry_to_parts(geometry),
                )
                polygon_area = GeometryCalculator.calculate_polygon_area(geometry)
            summary = PolygonShapeSummary(
                type="polygon", details=details, area=polygon_area
            )

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

    return FarmData(
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
        polygon=summary,
    )
