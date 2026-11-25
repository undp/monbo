import math
from typing import Final, Tuple, Union

from pyproj import Geod
from shapely.geometry import MultiPolygon, Point, Polygon
from shapely.geometry.polygon import orient

from app.config.logger import get_logger

# Get logger for this module
logger = get_logger("helpers.GeometryCalculator")


class GeometryCalculator:
    """Base class for geometry calculations used by multiple modules"""

    # Areas are measured on the WGS84 ellipsoid, the datum of the farms' coordinates
    GEOD: Final[Geod] = Geod(ellps="WGS84")

    @staticmethod
    def calculate_geometry_center(
        geom: Union[Polygon, MultiPolygon, Point],
    ) -> Tuple[float, float]:
        """
        Calculate the center point of a geometry (Polygon, MultiPolygon or Point):
        the center of its bounds, so every part of a farm is centered.

        Args:
            geom: A shapely geometry object (Polygon, MultiPolygon or Point)

        Returns:
            Tuple of (center_lat, center_lon) coordinates

        Raises:
            ValueError: If geometry type is not Polygon, MultiPolygon or Point
        """
        if geom.geom_type in ("Polygon", "MultiPolygon"):
            min_x, min_y, max_x, max_y = geom.bounds
            center_lon = (min_x + max_x) / 2
            center_lat = (min_y + max_y) / 2
        elif geom.geom_type == "Point":
            # Handle Point type: we can just use the point coordinates directly
            center_lon, center_lat = geom.x, geom.y
        else:
            error_msg = f"Unsupported geometry type: {geom.geom_type}"
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.debug(f"Calculated geometry center: lat={center_lat}, lon={center_lon}")
        return center_lat, center_lon

    @staticmethod
    def calculate_polygon_area(polygon: Polygon | MultiPolygon) -> float:
        """
        The geodesic area of a farm (or an overlap) on the WGS84 ellipsoid: exact,
        with no map projection, so it never fails because of where the farm lies
        (the Albers projections it replaced were undefined for a farm whose
        latitudes are opposite about the equator).

        Args:
            polygon (Polygon | MultiPolygon): The farm (or overlap) whose area to
                calculate: its parts are added and its holes subtracted

        Returns:
            float: The area in square meters, rounded to 2 decimal places. -1 for an
                invalid polygon, or one whose area isn't a finite number, and 0 for
                an empty one, which the validation and the analysis rely on.
        """
        if not polygon.is_valid:
            return -1

        if polygon.is_empty:
            return 0

        # pyproj adds each ring's signed area (positive when counter-clockwise), so
        # every exterior must wind counter-clockwise and every hole clockwise
        parts = polygon.geoms if isinstance(polygon, MultiPolygon) else [polygon]
        oriented = MultiPolygon([orient(part, sign=1.0) for part in parts])
        area, _ = GeometryCalculator.GEOD.geometry_area_perimeter(oriented)
        if not math.isfinite(area):
            # Shapely accepts coordinates that aren't on the ellipsoid (a latitude
            # beyond the poles); pyproj gives NaN for them. Uploads reject them,
            # but a NaN must never reach a response as a null area
            logger.warning(f"Non-finite area for polygon with bounds {polygon.bounds}")
            return -1
        return round(abs(area), 2)
