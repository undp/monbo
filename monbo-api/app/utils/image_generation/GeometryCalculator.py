from typing import Tuple
from shapely.geometry.base import BaseGeometry
from app.config.logger import get_logger

# Get logger for this module
logger = get_logger("utils.image_generation.GeometryCalculator")


class GeometryCalculator:
    """Base class for geometry calculations used by multiple modules"""

    @staticmethod
    def calculate_geometry_center(geom: BaseGeometry) -> Tuple[float, float]:
        """
        Calculate the center point of a geometry (Polygon or Point).

        Args:
            geom: A shapely geometry object (Polygon or Point)

        Returns:
            Tuple of (center_lat, center_lon) coordinates

        Raises:
            ValueError: If geometry type is not Polygon or Point
        """
        if geom.geom_type == "Polygon":
            # Handle Polygon type
            (min_x, min_y, max_x, max_y) = geom.bounds
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
