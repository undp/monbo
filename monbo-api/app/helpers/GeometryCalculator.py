from typing import Tuple, Union, Final
from app.config.logger import get_logger
import math
from pyproj import CRS, Transformer
from shapely.ops import transform
from shapely.geometry import Polygon, Point
from app.utils.image_generation.constants import GeographicConstants


# Get logger for this module
logger = get_logger("helpers.GeometryCalculator")


class GeometryCalculator:
    """Base class for geometry calculations used by multiple modules"""

    # Constants for area calculation
    SMALL_AREA_THRESHOLD: Final[float] = 0.1  # degrees
    HIGH_LATITUDE_THRESHOLD: Final[float] = 60  # degrees
    LARGE_AREA_THRESHOLD: Final[float] = 1.0  # degrees
    ERROR_THRESHOLD: Final[float] = 5.0  # percent

    # Define CRS at class level
    WGS84_CRS: Final[CRS] = CRS("EPSG:4326")
    GLOBAL_CRS: Final[CRS] = CRS.from_proj4(
        "+proj=aea +lat_1=30 +lat_2=60 +lon_0=0 +lat_0=0"
    )

    @staticmethod
    def calculate_geometry_center(geom: Union[Polygon, Point]) -> Tuple[float, float]:
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

    @staticmethod
    def _calculate_small_area(
        width_deg: float,
        height_deg: float,
        center_lat: float,
    ) -> float:
        """
        Calculate area for small polygons using a simplified formula (haversine).

        This method is most accurate for small areas (< 0.1 degrees) and provides
        a fast approximation. For larger areas, consider using projection-based methods.
        The calculation uses the METERS_PER_DEGREE constant (111,320 meters/degree at
        equator) and adjusts for latitude using cosine correction.

        Args:
            width_deg: Width of the polygon in degrees longitude
            height_deg: Height of the polygon in degrees latitude
            center_lat: Center latitude of the polygon, used for cosine correction

        Returns:
            float: Area in square meters, rounded to 2 decimal places

        Note:
            This is an approximation that works well for small areas near the equator.
            For high latitudes (> 60°) or large areas (> 1°), use projection-based
            methods for better accuracy.
        """
        width_meters = (
            GeographicConstants.METERS_PER_DEGREE
            * math.cos(math.radians(center_lat))
            * width_deg
        )
        height_meters = GeographicConstants.METERS_PER_DEGREE * height_deg
        return round(width_meters * height_meters, 2)

    @staticmethod
    def _calculate_area_with_local_projection(
        polygon: Polygon,
        bounds: Tuple[float, float, float, float],
    ) -> float:
        """Calculate area using a local projection optimized for the polygon's location.

        This method creates a local Albers Equal Area projection centered on the
        polygon's location to calculate its area accurately. This is especially useful
        for polygons at high latitudes where global projections may introduce
        significant distortion.

        Args:
            polygon: The shapely Polygon object to calculate area for
            bounds: Tuple of (lon_min, lat_min, lon_max, lat_max) defining the
                   bounding box of the polygon

        Returns:
            float: The area of the polygon in square meters, rounded to 2 decimal places

        Note:
            The method uses the Albers Equal Area projection which preserves areas while
            minimizing distortion by setting the standard parallels to the polygon's
            minimum and maximum latitudes.
        """
        lon_min, lat_min, lon_max, lat_max = bounds
        local_crs = CRS.from_proj4(
            f"+proj=aea +lat_1={lat_min} +lat_2={lat_max} "
            f"+lon_0={(lon_min + lon_max) / 2} +lat_0={(lat_min + lat_max) / 2}"
        )
        transformer = Transformer.from_crs(
            GeometryCalculator.WGS84_CRS, local_crs, always_xy=True
        )
        projected_polygon = transform(transformer.transform, polygon)
        return round(projected_polygon.area, 2)

    @staticmethod
    def _calculate_area_with_global_projection(polygon: Polygon) -> float:
        """Calculate area using a global projection for mid/low latitude areas.

        This method uses an Albers Equal Area projection with standard parallels at 30°N
        and 60°N, which provides good area preservation for most mid-latitude regions.

        Args:
            polygon: The shapely Polygon object to calculate area for

        Returns:
            float: The area of the polygon in square meters, rounded to 2 decimal places

        Note:
            This projection works best for areas between 30°N and 60°N latitude.
            For areas outside this range, consider using
            _calculate_area_with_local_projection() for better accuracy.
        """
        transformer = Transformer.from_crs(
            GeometryCalculator.WGS84_CRS,
            GeometryCalculator.GLOBAL_CRS,
            always_xy=True,
        )
        projected_polygon = transform(transformer.transform, polygon)
        return round(projected_polygon.area, 2)

    @staticmethod
    def _check_area_accuracy(
        polygon: Polygon,
        calculated_area: float,
        center_lat: float,
        bounds: Tuple[float, float, float, float],
    ) -> None:
        """
        Check the accuracy of the area calculation and log warnings if necessary.
        Only performs the check for large areas to avoid performance impact.

        Args:
            polygon: The shapely Polygon object to check accuracy for
            calculated_area: The previously calculated area to compare against
            center_lat: The center latitude of the polygon

        Note:
            This method uses a local Albers Equal Area projection as the ground truth
            and logs a warning if the percent error exceeds ERROR_THRESHOLD (5%).
            The warning includes the error percentage and polygon location.
        """
        # Calculate area using local projection for comparison
        bounds = polygon.bounds
        lon_min, lat_min, lon_max, lat_max = bounds
        local_crs = CRS.from_proj4(
            f"+proj=aea +lat_1={lat_min} +lat_2={lat_max} "
            f"+lon_0={(lon_min + lon_max) / 2} +lat_0={(lat_min + lat_max) / 2}"
        )
        transformer = Transformer.from_crs(
            GeometryCalculator.WGS84_CRS, local_crs, always_xy=True
        )
        local_projected = transform(transformer.transform, polygon)
        local_area = local_projected.area

        # Calculate percent error
        percent_error = abs((calculated_area - local_area) / local_area * 100)

        if percent_error > GeometryCalculator.ERROR_THRESHOLD:
            logger.warning(
                f"Large area calculation might have significant error: "
                f"{percent_error:.1f}% for polygon at {center_lat:.1f}°N"
            )

    @staticmethod
    def calculate_polygon_area(polygon: Polygon) -> float:
        """
        Calculate the area of a given polygon using optimized methods
        based on size and location.

        Args:
            polygon (Polygon): The polygon for which to calculate the area

        Returns:
            float: The area in square meters, rounded to 2 decimal places

        The method uses different calculation strategies based on:
        1. Size of the polygon (small vs large)
        2. Latitude of the polygon (high vs mid/low)
        3. Potential error in the calculation
        """
        # Validate polygon
        if not polygon.is_valid:
            return -1
            # raise ValueError("Invalid polygon provided")

        if polygon.is_empty:
            return 0

        # Get polygon bounds and calculate dimensions
        bounds = polygon.bounds
        lon_min, lat_min, lon_max, lat_max = bounds
        width_deg = lon_max - lon_min
        height_deg = lat_max - lat_min
        center_lat = (lat_min + lat_max) / 2

        # Strategy 1: Fast calculation for small areas
        if (
            width_deg < GeometryCalculator.SMALL_AREA_THRESHOLD
            and height_deg < GeometryCalculator.SMALL_AREA_THRESHOLD
        ):
            return GeometryCalculator._calculate_small_area(
                width_deg, height_deg, center_lat
            )

        # Strategy 2: High latitude or large area - use local projection
        if (
            abs(center_lat) > GeometryCalculator.HIGH_LATITUDE_THRESHOLD
            or width_deg > GeometryCalculator.LARGE_AREA_THRESHOLD
            or height_deg > GeometryCalculator.LARGE_AREA_THRESHOLD
        ):
            return GeometryCalculator._calculate_area_with_local_projection(
                polygon, bounds
            )

        # Strategy 3: Mid/low latitude and medium area - use global projection
        area = GeometryCalculator._calculate_area_with_global_projection(polygon)

        # Check for potential large errors
        if (
            width_deg > GeometryCalculator.LARGE_AREA_THRESHOLD
            or height_deg > GeometryCalculator.LARGE_AREA_THRESHOLD
        ):
            GeometryCalculator._check_area_accuracy(
                polygon,
                area,
                center_lat,
                bounds,
            )

        return area
