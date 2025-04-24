import math
from typing import Tuple
import numpy as np
from app.utils.image_generation.constants import GeographicConstants
from app.config.logger import get_logger


"""
TODO:
- add tests for the classes
"""


# Get logger for this module
logger = get_logger("utils.image_generation.GeoHelper")


class GeoHelper:

    @staticmethod
    def validate_coordinates(lat: float, lon: float) -> Tuple[float, float]:
        """
        Validate and clamp latitude/longitude values to valid ranges.

        Args:
            lat (float): Latitude in degrees, will be clamped to Web Mercator
                projection limits (-85.0511° to 85.0511°)
            lon (float): Longitude in degrees, will be normalized to -180° to 180° range

        Returns:
            Tuple[float, float]: Validated and normalized (lat, lon) coordinates where:
                - lat is clamped between -85.0511° and 85.0511°
                - lon is normalized between -180° and 180°
        """
        original_lat, original_lon = lat, lon

        # Clamp latitude to the Web Mercator projection limits
        lat = GeoHelper.clamp_latitude(lat)

        # Normalize longitude to -180 to 180
        lon = GeoHelper.normalize_longitude(lon)

        if original_lat != lat or original_lon != lon:
            logger.debug(
                "Coordinates normalized: (%f, %f) -> (%f, %f)",
                original_lat,
                original_lon,
                lat,
                lon,
            )

        return lat, lon

    @staticmethod
    def get_center_of_bounds(
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
    ) -> Tuple[float, float]:
        """
        Calculate the center point of a bounding box.

        Handles cases where the bounding box crosses the 180° meridian by adjusting
        the longitude calculation to account for the wrap-around.

        Args:
            min_lat (float): Minimum latitude of the bounds in degrees
            max_lat (float): Maximum latitude of the bounds in degrees
            min_lon (float): Minimum longitude of the bounds in degrees
            max_lon (float): Maximum longitude of the bounds in degrees

        Returns:
            Tuple[float, float]: (center_lat, center_lon) coordinates where:
                - center_lat is the midpoint between min_lat and max_lat
                - center_lon is the midpoint between min_lon and max_lon, adjusted
                  if the box crosses the 180° meridian
        """
        lat = (min_lat + max_lat) / 2

        # Handle the case where the bounding box crosses the 180° meridian
        if min_lon > max_lon:
            logger.debug("Bounding box crosses the 180° meridian")
            # Box crosses the 180° meridian
            lon = (min_lon + max_lon + 360) / 2
            if lon > 180:
                lon -= 360
        else:
            lon = (min_lon + max_lon) / 2

        logger.debug(
            (
                "Center of bounds: min_lat=%f, max_lat=%f, "
                "min_lon=%f, max_lon=%f -> center=(%f, %f)"
            ),
            min_lat,
            max_lat,
            min_lon,
            max_lon,
            lat,
            lon,
        )

        return lat, lon

    @staticmethod
    def normalize_longitude(lon: float) -> float:
        """
        Normalize longitude to the -180 to 180 range.
        """
        return ((lon + 180) % 360) - 180

    @staticmethod
    def clamp_latitude(lat: float) -> float:
        """
        Clamp latitude to the Web Mercator projection limits.
        """
        return max(
            min(lat, GeographicConstants.MAX_LATITUDE), GeographicConstants.MIN_LATITUDE
        )

    @staticmethod
    def latitude_to_radians(lat: float) -> float:
        """
        Convert latitude to radians using the Web Mercator projection formula.

        This function converts a latitude value in degrees to radians using the
        Web Mercator projection formula, which is used by Google Maps. The result
        is clamped between -pi/2 and pi/2 to prevent infinite values near the poles.

        Args:
            lat (float): Latitude in degrees, will be clamped to Web Mercator
                projection limits (-85.0511° to 85.0511°)

        Returns:
            float: Latitude in radians, clamped between -pi/2 and pi/2
        """
        original_lat = lat

        # First validate the input latitude
        lat = GeoHelper.clamp_latitude(lat)

        if original_lat != lat:
            logger.debug("Latitude clamped: %f -> %f", original_lat, lat)

        sin = math.sin(lat * math.pi / 180)
        rad_x2 = math.log((1 + sin) / (1 - sin)) / 2
        return max(min(rad_x2, math.pi), -math.pi) / 2

    @staticmethod
    def meters_to_degrees(meters: float, latitude: float) -> Tuple[float, float]:
        """
        Convert meters to approximate degrees at the given latitude using Earth's
        radius (WGS84 equatorial radius).

        Near the poles (where absolute cosine of latitude < 0.001), the longitude
        conversion defaults to the same value as latitude for numerical stability.

        Args:
            meters (float): Distance in meters to convert
            latitude (float): Latitude in degrees where the conversion is needed

        Returns:
            Tuple[float, float]: A tuple containing:
                - degrees_lat: Degrees of latitude corresponding to the meters
                - degrees_lon: Degrees of longitude corresponding to the meters,
                  adjusted for the given latitude
        """
        # Convert latitude to radians for calculations
        lat_radians = np.radians(latitude)

        # Calculate degrees of latitude
        # One full circle (360°) corresponds to 2π*R meters (Earth's circumference)
        degrees_lat = (
            meters / (2 * np.pi * GeographicConstants.EARTH_RADIUS_METERS)
        ) * 360

        # Calculate degrees of longitude (varies with latitude)
        # At the equator, one degree of longitude equals one degree of latitude
        # At higher latitudes, the distance between longitude lines decreases
        # We use cos(latitude) to account for this narrowing
        if np.abs(np.cos(lat_radians)) > 0.001:  # Avoid division by zero near poles
            # For longitude, we need to consider the radius at this latitude
            # which is earth_radius * cos(latitude)
            degrees_lon = (
                meters
                / (
                    2
                    * np.pi
                    * GeographicConstants.EARTH_RADIUS_METERS
                    * np.cos(lat_radians)
                )
            ) * 360
        else:
            # Near the poles, use the same value as latitude for safety
            degrees_lon = degrees_lat

        return degrees_lat, degrees_lon
