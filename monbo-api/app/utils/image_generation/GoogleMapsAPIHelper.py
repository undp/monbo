import math
from typing import Tuple
from .GeoHelper import GeoHelper
from app.config.env import GCP_MAPS_PLATFORM_API_KEY, GCP_MAPS_PLATFORM_SIGNATURE_SECRET
from app.utils.image_generation.constants import MapDefaults
from app.utils.image_generation.GeometryCalculator import GeometryCalculator
from app.utils.image_generation.errors import GoogleMapsAPIError
from PIL import Image
from shapely.geometry.base import BaseGeometry
from io import BytesIO
import httpx
import hashlib
import hmac
import base64
import urllib.parse as urlparse
from app.config.logger import get_logger

# Get logger for this module
logger = get_logger("utils.image_generation.GoogleMapsAPIHelper")


class GoogleMapsAPIHelper:
    WORLD_HEIGHT = 256  # pixels
    WORLD_WIDTH = 256  # pixels
    EARTH_CIRCUMFERENCE_AT_EQUATOR = 40075000  # meters
    ZOOM_MIN = 0
    ZOOM_MAX = 21
    TILE_SIZE = 256  # pixels

    @staticmethod
    def clamp_zoom(zoom: int) -> int:
        return max(
            min(zoom, GoogleMapsAPIHelper.ZOOM_MAX), GoogleMapsAPIHelper.ZOOM_MIN
        )

    @staticmethod
    def calculate_pixels_per_meter(lat: float, zoom: int) -> float:
        """
        Calculate how many pixels correspond to one meter at a given latitude
        and zoom level.

        Args:
            lat (float): Latitude in degrees, will be clamped to Web Mercator
                projection limits (-85.0511° to 85.0511°)
            zoom (int): Zoom level, will be clamped between ZOOM_MIN(0) and ZOOM_MAX(21)

        Returns:
            float: Number of pixels per meter at the specified latitude and zoom level
        """
        # Validate inputs
        lat, _ = GeoHelper.validate_coordinates(lat, 0)
        zoom = GoogleMapsAPIHelper.clamp_zoom(zoom)

        # Base pixels per meter at the equator at zoom level 0
        # The earth's circumference at the equator is approximately 40,075,000 meters
        # At zoom level 0, the entire world map is 256 pixels wide
        equator_pixels_per_meter_at_zoom_0 = (
            GoogleMapsAPIHelper.WORLD_WIDTH
            / GoogleMapsAPIHelper.EARTH_CIRCUMFERENCE_AT_EQUATOR
        )

        # Scale for the current zoom level (each zoom level doubles the resolution)
        zoom_scale = 2**zoom

        # Calculate pixels per meter at the equator for the current zoom level
        equator_pixels_per_meter = equator_pixels_per_meter_at_zoom_0 * zoom_scale

        # Apply latitude correction (Mercator projection distortion)
        # At the equator cos(0) = 1, at higher latitudes the value decreases
        lat_correction = abs(math.cos(math.radians(lat)))

        # Return the corrected value
        return equator_pixels_per_meter * lat_correction

    @staticmethod
    def _calculate_zoom_from_dimensions(
        map_px: int,
        world_px: int,
        fraction: float,
    ) -> int:
        """
        Calculate the appropriate zoom level based on map dimensions and coverage.

        This helper method determines the zoom level needed to properly display a
        portion of the map given the desired map size in pixels, the full world
        map size, and the fraction of the world being displayed.

        The zoom level is calculated using the formula:
        zoom = floor(log2(map_px / world_px / fraction))

        This ensures that the given fraction of the world map will fit within
        the desired pixel dimensions at the calculated zoom level.

        Args:
            map_px (int): The desired map dimension in pixels (width or height)
            world_px (int): The corresponding full world map dimension
                (WORLD_WIDTH or WORLD_HEIGHT)
            fraction (float): The fraction of the world dimension being displayed
                (0 to 1). Values <= 1e-10 will return ZOOM_MAX, values >= 1.0
                will return ZOOM_MIN.

        Returns:
            int: The calculated zoom level, rounded down to the nearest integer
                and clamped between ZOOM_MIN (0) and ZOOM_MAX (21)
        """
        # Handle edge case where fraction is extremely small or zero
        if fraction <= 1e-10:
            return GoogleMapsAPIHelper.ZOOM_MAX

        # Handle edge case where fraction is extremely large
        if fraction >= 1.0:
            return GoogleMapsAPIHelper.ZOOM_MIN

        zoom = math.floor(math.log(map_px / world_px / fraction) / math.log(2))

        return GoogleMapsAPIHelper.clamp_zoom(zoom)

    @staticmethod
    def calculate_zoom_from_bounds(
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        image_size: Tuple[int, int],
    ) -> int:
        """
        Calculate the appropriate zoom level for a map region defined by
        latitude/longitude bounds.

        This method determines the optimal zoom level that will fit the given
        geographic bounds within the specified image dimensions, while maintaining
        the correct aspect ratio.
        The zoom level is calculated separately for latitude and longitude spans,
        and the smaller value is chosen to ensure the entire region fits within
        the image.

        Args:
            min_lat (float): Minimum latitude of the bounds in degrees
            max_lat (float): Maximum latitude of the bounds in degrees
            min_lon (float): Minimum longitude of the bounds in degrees
            max_lon (float): Maximum longitude of the bounds in degrees
            image_size (Tuple[int, int]): Desired image dimensions as
                (width, height) in pixels

        Returns:
            int: The optimal zoom level that fits the bounds within the image size,
                capped between ZOOM_MIN (0) and ZOOM_MAX (21)
        """
        logger.debug(
            f"Calculating zoom from bounds: min_lat={min_lat}, max_lat={max_lat}, "
            f"min_lon={min_lon}, max_lon={max_lon}, image_size={image_size}"
        )

        # Validate inputs
        min_lat, min_lon = GeoHelper.validate_coordinates(min_lat, min_lon)
        max_lat, max_lon = GeoHelper.validate_coordinates(max_lat, max_lon)

        # Ensure min_lat is actually less than max_lat
        if min_lat > max_lat:
            min_lat, max_lat = max_lat, min_lat

        # Apply padding to bounds
        # For latitude, we need to be careful with the Mercator projection
        min_lat_rad = GeoHelper.latitude_to_radians(min_lat)
        max_lat_rad = GeoHelper.latitude_to_radians(max_lat)
        lat_span_rad = max_lat_rad - min_lat_rad

        # Apply padding in radian space
        padding_rad = lat_span_rad * MapDefaults.PADDING_RATIO
        min_lat_rad -= padding_rad
        max_lat_rad += padding_rad

        # Calculate the padded latitude fraction
        lat_fraction = (max_lat_rad - min_lat_rad) / math.pi

        # Handle longitude span, including across the 180° meridian
        lon_span = max_lon - min_lon
        if lon_span < 0:  # Handle 180° meridian crossing
            lon_span += 360

        lon_padding = lon_span * MapDefaults.PADDING_RATIO
        padded_min_lon = min_lon - lon_padding
        padded_max_lon = max_lon + lon_padding

        # Normalize longitude values
        padded_min_lon = GeoHelper.normalize_longitude(padded_min_lon)
        padded_max_lon = GeoHelper.normalize_longitude(padded_max_lon)

        # Calculate longitude fraction with padding
        padded_lon_diff = padded_max_lon - padded_min_lon
        if padded_lon_diff < 0:  # Handle 180° meridian crossing
            padded_lon_diff += 360
        lon_fraction = padded_lon_diff / 360

        # Calculate zoom levels for latitude and longitude
        lat_zoom = GoogleMapsAPIHelper._calculate_zoom_from_dimensions(
            image_size[1], GoogleMapsAPIHelper.WORLD_HEIGHT, lat_fraction
        )
        lon_zoom = GoogleMapsAPIHelper._calculate_zoom_from_dimensions(
            image_size[0], GoogleMapsAPIHelper.WORLD_WIDTH, lon_fraction
        )
        logger.debug(
            f"Calculated zoom from bounds: lat_zoom={lat_zoom}, lon_zoom={lon_zoom}"
        )

        zoom_level = GoogleMapsAPIHelper.clamp_zoom(min(lat_zoom, lon_zoom))
        logger.debug(f"Calculated zoom level: {zoom_level}")
        return zoom_level

    @staticmethod
    def _lat_lon_to_pixel(lat: float, lon: float, zoom: int) -> Tuple[float, float]:
        """
        Convert geographic coordinates to pixel coordinates at a specific zoom level.

        Args:
            lat (float): Latitude in degrees, will be clamped to Web Mercator
                projection limits (-85.0511° to 85.0511°)
            lon (float): Longitude in degrees, will be normalized to -180° to 180° range
            zoom (int): Zoom level, will be clamped between ZOOM_MIN(0) and ZOOM_MAX(21)

        Returns:
            Tuple[float, float]: (x, y) pixel coordinates in the global tile space at
                the specified zoom level, where (0,0) is the top-left corner of the map
        """
        # Validate inputs
        lat, lon = GeoHelper.validate_coordinates(lat, lon)
        zoom = GoogleMapsAPIHelper.clamp_zoom(zoom)

        scale = GoogleMapsAPIHelper.TILE_SIZE * (2**zoom)
        x = (lon + 180) / 360 * scale
        siny = math.sin(lat * math.pi / 180)
        y = (0.5 - math.log((1 + siny) / (1 - siny)) / (4 * math.pi)) * scale
        return x, y

    @staticmethod
    def _pixel_to_lat_lon(x: float, y: float, zoom: int) -> Tuple[float, float]:
        """
        Convert pixel coordinates at a specific zoom level to geographic coordinates.

        Args:
            x (float): X pixel coordinate in the global tile space,
                where 0 is the left edge
            y (float): Y pixel coordinate in the global tile space,
                where 0 is the top edge
            zoom (int): Zoom level, will be clamped between ZOOM_MIN(0) and ZOOM_MAX(21)

        Returns:
            Tuple[float, float]: (lat, lon) geographic coordinates, where latitude is
                clamped to Web Mercator projection limits (-85.0511° to 85.0511°) and
                longitude is normalized to -180° to 180° range
        """
        # Validate zoom
        zoom = GoogleMapsAPIHelper.clamp_zoom(zoom)

        scale = GoogleMapsAPIHelper.TILE_SIZE * (2**zoom)
        lon = x / scale * 360 - 180
        lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / scale)))
        lat = lat_rad * 180 / math.pi

        # Normalize results
        lat, lon = GeoHelper.validate_coordinates(lat, lon)
        return lat, lon

    @staticmethod
    def get_image_bounds(
        center_lat: float,
        center_lon: float,
        zoom: int,
        image_size: Tuple[int, int],
    ) -> Tuple[float, float, float, float]:
        """
        Calculate the geographic bounds of an image based on center coordinates,
        zoom level, and image dimensions.

        Args:
            center_lat (float): Center latitude in degrees, will be normalized to
                Web Mercator projection limits (-85.0511° to 85.0511°)
            center_lon (float): Center longitude in degrees, will be normalized to
                -180° to 180° range
            zoom (int): Zoom level, will be clamped between ZOOM_MIN(0) and ZOOM_MAX(21)
            image_size (Tuple[int, int]): Image dimensions as (width, height) in pixels

        Returns:
            Tuple[float, float, float, float]: (min_lat, max_lat, min_lon, max_lon)
                bounds of the image, where latitudes are clamped to Web Mercator
                projection limits and longitudes are normalized to -180° to 180° range
        """
        logger.debug(
            f"Calculating image bounds: center_lat={center_lat}, "
            f"center_lon={center_lon}, zoom={zoom}, image_size={image_size}"
        )

        # Validate inputs
        center_lat, center_lon = GeoHelper.validate_coordinates(center_lat, center_lon)
        zoom = GoogleMapsAPIHelper.clamp_zoom(zoom)

        center_x, center_y = GoogleMapsAPIHelper._lat_lon_to_pixel(
            center_lat, center_lon, zoom
        )

        half_width = image_size[0] / 2
        half_height = image_size[1] / 2

        min_x_px = center_x - half_width
        max_x_px = center_x + half_width
        max_y_px = center_y - half_height  # Note: y increases downward in pixel space
        min_y_px = center_y + half_height

        min_lat, min_lon = GoogleMapsAPIHelper._pixel_to_lat_lon(
            min_x_px, max_y_px, zoom
        )
        max_lat, max_lon = GoogleMapsAPIHelper._pixel_to_lat_lon(
            max_x_px, min_y_px, zoom
        )

        # Ensure min_lat is actually less than max_lat
        if min_lat > max_lat:
            min_lat, max_lat = max_lat, min_lat

        # Ensure min_lon is actually less than max_lon
        if min_lon > max_lon:
            min_lon, max_lon = max_lon, min_lon

        logger.debug(
            f"Calculated image bounds: min_lat={min_lat}, max_lat={max_lat}, "
            f"min_lon={min_lon}, max_lon={max_lon}"
        )
        return (min_lat, max_lat, min_lon, max_lon)

    @staticmethod
    def add_signature(input_url: str) -> str:
        """
        Add a digital signature to a Google Maps API URL for authentication.

        This method takes a Google Maps API URL and adds a signature parameter using
        HMAC-SHA1 signing with a secret key. The signature helps verify that the request
        is coming from an authorized source.

        Args:
            input_url (str): The Google Maps API URL to sign

        Returns:
            str: The original URL with an added signature parameter

        Note:
            The secret key is hardcoded and should be stored securely in environment
            variables or configuration in production.
        """
        if not GCP_MAPS_PLATFORM_SIGNATURE_SECRET:
            raise GoogleMapsAPIError(
                "'GCP_MAPS_PLATFORM_SIGNATURE_SECRET' enviromental variable is not set"
            )
        url = urlparse.urlparse(input_url)

        # We only need to sign the path+query part of the string
        url_to_sign = url.path + "?" + url.query

        # Decode the private key into its binary format
        # We need to decode the URL-encoded private key
        decoded_key = base64.urlsafe_b64decode(GCP_MAPS_PLATFORM_SIGNATURE_SECRET)

        # Create a signature using the private key and the URL-encoded
        # string using HMAC SHA1. This signature will be binary.
        signature = hmac.new(decoded_key, str.encode(url_to_sign), hashlib.sha1)

        # Encode the binary signature into base64 for use within a URL
        encoded_signature = base64.urlsafe_b64encode(signature.digest())

        original_url = url.scheme + "://" + url.netloc + url.path + "?" + url.query

        # Return signed URL
        return original_url + "&signature=" + encoded_signature.decode()

    @staticmethod
    async def get_google_maps_satellite_image(
        geom: BaseGeometry,
        zoom_level: int,
        output_size: Tuple[int, int] = MapDefaults.OUTPUT_SIZE,
    ) -> Image.Image:
        """
        Get a Google Maps satellite image for a given geometry.

        Args:
            geom: A shapely geometry object (Polygon or Point)
            output_size: Tuple of (width, height) in pixels for the output image.
                Defaults to MapDefaults.OUTPUT_SIZE.

        Returns:
            PIL Image: The satellite image from Google Maps. If the API request fails,
                returns a black image of the specified size.

        Raises:
            GeometryTypeError: If geometry type is not supported
            GoogleMapsAPIError: If there's an error with the Google Maps API request
        """
        # Fetch satellite image with calculated center and zoom level
        # Google Maps API expects (lat, lon) format for center
        center_lat, center_lon = GeometryCalculator.calculate_geometry_center(geom)

        # Construct the URL for Google Maps Static API
        url = (
            f"https://maps.googleapis.com/maps/api/staticmap"
            f"?maptype={MapDefaults.MAP_TYPE}&size={output_size[0]}x{output_size[1]}"
            f"&center={center_lat},{center_lon}&zoom={zoom_level}"
            f"&key={GCP_MAPS_PLATFORM_API_KEY}"
        )
        url = GoogleMapsAPIHelper.add_signature(url)
        logger.debug(f"Fetching Google Maps image from URL: {url}")

        # Make a request to fetch the image
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=10)
                response.raise_for_status()
                img = Image.open(BytesIO(response.content))
                return img
            except httpx.RequestError as e:
                # Handle network and API errors
                error_msg = f"Failed to fetch Google Maps image: {str(e)}"
                logger.error(error_msg)
                raise GoogleMapsAPIError(error_msg) from e
            except Exception as e:
                # Handle image processing errors
                error_msg = f"Failed to process Google Maps image: {str(e)}"
                logger.error(error_msg)
                raise GoogleMapsAPIError(error_msg) from e
