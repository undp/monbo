from io import BytesIO
from typing import Tuple, Optional
import numpy as np
import requests
from app.config.env import GOOGLE_SERVICE_API_KEY
from fastapi import APIRouter
from PIL import Image, ImageDraw
from pyproj import Transformer
from rasterio import open as rasterio_open
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
import logging


"""
The only meaningful improvements that might still be worth considering:
- Refactor the code to be more modular and easier to understand. Separate the methods
    by their nature (e.g. geometry handling, map generation, geospatial operations, etc)
- Caching for expensive operations: If you're calling functions like
    calculate_zoom_level repeatedly with the same parameters, implementing caching
    could improve performance.
- Comprehensive test suite: Adding unit and integration tests would help ensure
    the code works as expected and prevent regressions
- More robust error handling for geospatial operations: Some geospatial
    operations can fail in unexpected ways, especially with edge cases like geometries
    that cross the antimeridian.
"""

# Set up logger
logger = logging.getLogger(__name__)

# Set up router
router = APIRouter()


class NoRasterDataOverlapError(Exception):
    """Raised when the requested polygon doesn't overlap with the map's raster data"""

    pass


class MapGenerationError(Exception):
    """Base class for errors during map generation."""

    pass


class GeometryTypeError(MapGenerationError):
    """Raised when an unsupported geometry type is encountered."""

    pass


class ParameterValidationError(MapGenerationError):
    """Raised when parameters fail validation."""

    pass


class GoogleMapsAPIError(MapGenerationError):
    """Raised when there's an error with the Google Maps API."""

    pass


class MapDefaults:
    """Default parameters for map generation"""

    OUTPUT_SIZE = (500, 500)
    PADDING_RATIO = 0.3
    DEFAULT_POINT_RADIUS = 100  # meters
    ZOOM_BOOST = 1.0
    MAX_ZOOM = 20
    MIN_ZOOM = 1


# Define color constants and styling parameters
class MapColors:
    """
    Constants for map visualization colors and styling.
    All colors are in RGBA format (red, green, blue, alpha).
    """

    # Feature overlay colors
    FEATURE_FILL = (255, 235, 59, 40)  # Yellow with low opacity
    FEATURE_OUTLINE = (255, 235, 59, 230)  # Yellow with high opacity
    FEATURE_HIGHLIGHT = (255, 235, 59, 120)  # Yellow with medium opacity

    # Deforestation colors
    DEFORESTATION = (255, 20, 20, 180)  # Red with medium-high opacity


# Define styling parameters
class MapStyles:
    """
    Constants for map visualization styling parameters.
    """

    # Anti-aliasing parameters
    SCALE_FACTOR = 3  # Scale factor for anti-aliased rendering
    POLYGON_LINE_WIDTH = 6  # Width of polygon outline in scaled space

    # Point visualization
    MIN_POINT_RADIUS_PIXELS = 25  # Minimum radius for point visualization
    POINT_PIXELS_PER_METER_AT_ZOOM_18 = 0.596  # Conversion factor at zoom level 18


class RasterDataContext:
    """Context manager for handling raster data operations."""

    def __init__(self, tif_path, target_crs="EPSG:3857"):
        self.tif_path = tif_path
        self.target_crs = target_crs
        self.src = None
        self.vrt = None

    def __enter__(self):
        self.src = rasterio_open(self.tif_path)
        self.vrt = WarpedVRT(self.src, crs=self.target_crs)
        return self.vrt

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.vrt:
            self.vrt.close()
        if self.src:
            self.src.close()


def get_google_maps_satellite_image(center, zoom, size=MapDefaults.OUTPUT_SIZE):
    # Construct the URL for Google Maps Static API
    url = (
        f"https://maps.googleapis.com/maps/api/staticmap?"
        f"center={center[0]},{center[1]}&zoom={zoom}&size={size[0]}x{size[1]}"
        f"&maptype=satellite&key={GOOGLE_SERVICE_API_KEY}"
    )

    # Make a request to fetch the image
    response = requests.get(url)

    # Check if the request was successful
    if response.status_code != 200:
        logger.error(f"Error from Google Maps API: Status {response.status_code}")
        logger.error(f"Response content: {response.text[:200]}...")
        # Return a fallback image
        return Image.new("RGB", size, color=(0, 0, 0))

    try:
        # Open the image
        img = Image.open(BytesIO(response.content))
        logger.debug("Successfully retrieved satellite image")
        return img
    except Exception as e:
        logger.exception(f"Failed to process image: {e}")
        logger.error(f"Response headers: {response.headers}")
        # Return a fallback image
        return Image.new("RGB", size, color=(0, 0, 0))


def validate_geometry_parameters(
    geom_type: str, point_radius_meters: float | None = None
):
    """
    Validate geometry parameters based on geometry type.

    Args:
        geom_type: The geometry type ("Polygon", "Point", etc.)
        point_radius_meters: Radius parameter for Point geometries

    Raises:
        ValueError: If parameters are invalid for the given geometry type
    """
    if geom_type == "Polygon":
        if point_radius_meters is not None:
            raise ParameterValidationError(
                "'point_radius_meters' parameter is not supported for "
                "Polygon geometries"
            )
    elif geom_type == "Point":
        if point_radius_meters is None:
            raise ParameterValidationError(
                "'point_radius_meters' parameter is required for Point geometries"
            )
    else:
        raise GeometryTypeError(f"Unsupported geometry type: '{geom_type}'")


class GeometryHandler:
    """Handles processing for different geometry types."""

    @staticmethod
    def reproject_geometry(
        geom: BaseGeometry,
        source_crs: str = "EPSG:4326",
        target_crs: str = "EPSG:3857",
        point_radius_meters: Optional[float] = None,
    ) -> BaseGeometry:
        """
        Reproject a geometry from source CRS to target CRS.

        Args:
            geom: A shapely geometry object (Polygon or Point)
            source_crs: Source coordinate reference system
            target_crs: Target coordinate reference system
            point_radius_meters: For Point geometries, the radius in meters
            for buffering

        Returns:
            Reprojected geometry
        """
        # Validate geometry type and parameters
        validate_geometry_parameters(geom.geom_type, point_radius_meters)

        # Create transformer for the coordinate transformation
        transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)

        if geom.geom_type == "Polygon":
            # For Polygon geometries, transform all coordinates
            # In GeoJSON, coordinates are [longitude, latitude]
            reprojected_coords = [
                transformer.transform(lon, lat) for lon, lat in geom.exterior.coords
            ]
            return shape({"type": "Polygon", "coordinates": [reprojected_coords]})

        elif geom.geom_type == "Point":
            # For Point geometries, transform the point and optionally create a buffer
            from shapely.geometry import Point

            x, y = transformer.transform(geom.x, geom.y)
            point_proj = Point(x, y)

            # If radius is provided, create a buffer (only makes sense in projected CRS)
            if point_radius_meters is not None and target_crs == "EPSG:3857":
                return point_proj.buffer(point_radius_meters)
            return point_proj

        else:
            raise GeometryTypeError(f"Unsupported geometry type: {geom.geom_type}")

    @staticmethod
    def create_feature_overlay(geom, output_size, zoom_level, point_radius_meters=None):
        """
        Create appropriate feature overlay based on geometry type.

        Args:
            geom: A shapely geometry object
            output_size: Tuple of (width, height) for the output image
            zoom_level: Google Maps zoom level
            point_radius_meters: For Point geometries, the radius in meters

        Returns:
            PIL Image with the feature overlay
        """
        if geom.geom_type == "Polygon":
            return generate_polygon_image(geom, output_size, zoom_level)
        elif geom.geom_type == "Point":
            return generate_point_overlay(
                geom, output_size, zoom_level, point_radius_meters
            )
        else:
            raise GeometryTypeError(f"Unsupported geometry type: {geom.geom_type}")


def meters_to_degrees(meters: float, latitude: float) -> tuple[float, float]:
    """
    Convert meters to approximate degrees at the given latitude using Earth's radius.

    Args:
        meters: Distance in meters
        latitude: Latitude in degrees where the conversion is needed

    Returns:
        tuple: (degrees_lat, degrees_lon) - equivalent degrees in latitude and longitude
    """
    # Earth's radius in meters
    earth_radius = 6378137  # WGS84 equatorial radius

    # Convert latitude to radians for calculations
    lat_radians = np.radians(latitude)

    # Calculate degrees of latitude
    # One full circle (360°) corresponds to 2π*R meters (Earth's circumference)
    degrees_lat = (meters / (2 * np.pi * earth_radius)) * 360

    # Calculate degrees of longitude (varies with latitude)
    # At the equator, one degree of longitude equals one degree of latitude
    # At higher latitudes, the distance between longitude lines decreases
    # We use cos(latitude) to account for this narrowing
    if np.abs(np.cos(lat_radians)) > 0.001:  # Avoid division by zero near poles
        # For longitude, we need to consider the radius at this latitude
        # which is earth_radius * cos(latitude)
        degrees_lon = (meters / (2 * np.pi * earth_radius * np.cos(lat_radians))) * 360
    else:
        # Near the poles, use the same value as latitude for safety
        degrees_lon = degrees_lat

    return degrees_lat, degrees_lon


def calculate_geometry_bounds(
    geom: BaseGeometry, point_radius_meters: Optional[float] = None
) -> Tuple[float, float, float, float]:
    """
    Calculate the bounding box of a geometry (Polygon or Point).

    Args:
        geom: A shapely geometry object (Polygon or Point)
        point_radius_meters: For Point geometries, the radius in meters
        to create a boundary

    Returns:
        Tuple of (min_lon, max_lon, min_lat, max_lat) defining the bounding box
    """
    # Validate parameters
    validate_geometry_parameters(geom.geom_type, point_radius_meters)

    if geom.geom_type == "Polygon":
        # Handle Polygon type
        lons, lats = zip(*[(lon, lat) for lon, lat in geom.exterior.coords])
    elif geom.geom_type == "Point":
        # Handle Point type - point_radius_meters already validated
        # Convert radius from meters to degrees
        radius_lat, radius_lon = meters_to_degrees(point_radius_meters, geom.y)

        # Create bounds that include the radius around the point
        lons = [geom.x - radius_lon, geom.x + radius_lon]
        lats = [geom.y - radius_lat, geom.y + radius_lat]

    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    return min_lon, max_lon, min_lat, max_lat


def calculate_geometry_center(geom):
    """
    Calculate the center point of a geometry (Polygon or Point).

    Args:
        geom: A shapely geometry object (Polygon or Point)
        point_radius_meters: For Point geometries, used if we need to calculate bounds

    Returns:
        Tuple of (center_lon, center_lat) coordinates
    """
    if geom.geom_type == "Polygon":
        # Handle Polygon type
        min_lon, max_lon, min_lat, max_lat = calculate_geometry_bounds(geom)
        center_lon = (max_lon + min_lon) / 2
        center_lat = (max_lat + min_lat) / 2
    elif geom.geom_type == "Point":
        # Handle Point type - for points, we can just use the point coordinates directly
        center_lon, center_lat = geom.x, geom.y
    else:
        raise ValueError(f"Unsupported geometry type: {geom.geom_type}")

    return center_lon, center_lat


def generate_deforestation_image(
    geom,
    tif_path,
    output_size=MapDefaults.OUTPUT_SIZE,
    padding_ratio=MapDefaults.PADDING_RATIO,
    point_radius_meters=None,
):
    with RasterDataContext(tif_path) as vrt:
        # Reproject the geometry to match the VRT's CRS
        geom_proj = GeometryHandler.reproject_geometry(
            geom,
            source_crs="EPSG:4326",
            target_crs="EPSG:3857",
            point_radius_meters=point_radius_meters,
        )

        # Calculate padded bounds
        minx, miny, maxx, maxy = geom_proj.bounds
        width = maxx - minx
        height = maxy - miny
        pad_x = width * padding_ratio
        pad_y = height * padding_ratio
        padded_bounds = (minx - pad_x, miny - pad_y, maxx + pad_x, maxy + pad_y)

        # Check if the window intersects with the VRT's bounds
        vrt_bounds = vrt.bounds
        if (
            (padded_bounds[0] > vrt_bounds[2])
            or (padded_bounds[2] < vrt_bounds[0])
            or (padded_bounds[1] > vrt_bounds[3])
            or (padded_bounds[3] < vrt_bounds[1])
        ):
            raise NoRasterDataOverlapError(
                "The requested polygon does not overlap with the requested map's "
                "raster data"
            )

        # Read the raster window
        window = vrt.window(*padded_bounds)
        vrt.window_transform(window)
        data = vrt.read(
            1,
            window=window,
            out_shape=(output_size[1], output_size[0]),
            resampling=Resampling.nearest,
        )

        # Create deforestation mask using the defined colors
        mask_data = (data == 1).astype(np.uint8)
        rgba_data = np.zeros((output_size[1], output_size[0], 4), dtype=np.uint8)
        rgba_data[..., 0] = mask_data * MapColors.DEFORESTATION[0]
        rgba_data[..., 1] = mask_data * MapColors.DEFORESTATION[1]
        rgba_data[..., 2] = mask_data * MapColors.DEFORESTATION[2]
        rgba_data[..., 3] = mask_data * MapColors.DEFORESTATION[3]

        mask_img = Image.fromarray(rgba_data, mode="RGBA")
        return mask_img


def calculate_zoom_level(
    geom,
    output_size=MapDefaults.OUTPUT_SIZE,
    padding_ratio=MapDefaults.PADDING_RATIO,
    point_radius_meters=None,
) -> int:
    # Calculate approximate width and height in degrees
    min_lon, max_lon, min_lat, max_lat = calculate_geometry_bounds(
        geom, point_radius_meters
    )
    width_degrees = max_lon - min_lon
    height_degrees = max_lat - min_lat

    # Add padding
    padded_min_lon = min_lon - width_degrees * padding_ratio
    padded_max_lon = max_lon + width_degrees * padding_ratio
    padded_min_lat = min_lat - height_degrees * padding_ratio
    padded_max_lat = max_lat + height_degrees * padding_ratio

    padded_width = padded_max_lon - padded_min_lon
    padded_height = padded_max_lat - padded_min_lat

    # Calculate zoom level based on the size of the area and the output image size
    # The formula is based on the Google Maps API reference
    # We want to ensure the entire padded area fits within our image

    # Estimate required zoom level based on the larger dimension
    # At zoom level 0, the world is 256px wide/tall
    # Each zoom level doubles the resolution
    world_width_degrees = 360
    world_height_degrees = 170  # Approximate, excluding polar regions

    x_zoom = np.log2(output_size[0] / 256 * world_width_degrees / padded_width)
    y_zoom = np.log2(output_size[1] / 256 * world_height_degrees / padded_height)

    # Use the more conservative zoom to ensure the entire area fits
    calculated_zoom = min(x_zoom, y_zoom)

    # Apply zoom and round to integer, with limits
    # Add a zoom boost to get closer (increase this number for closer zoom)
    zoom_boost = MapDefaults.ZOOM_BOOST
    if geom.geom_type == "Point":
        zoom_boost += 1.0  # Add one more zoom level for points

    # Limit max zoom
    zoom_level = min(int(calculated_zoom + zoom_boost), MapDefaults.MAX_ZOOM)

    # For large polygons, we need to allow smaller zoom levels
    # Remove the min zoom restriction or set a more reasonable minimum
    zoom_level = max(zoom_level, MapDefaults.MIN_ZOOM)  # Allow much lower zoom levels

    return zoom_level


def generate_satellite_image(geom, output_size, zoom_level):
    # Fetch satellite image with calculated zoom level
    # Google Maps API expects (lat, lon) format for center
    center_lon, center_lat = calculate_geometry_center(geom)
    google_center = [center_lat, center_lon]
    satellite_img = get_google_maps_satellite_image(
        google_center, zoom=zoom_level, size=output_size
    )
    return satellite_img


def latlon_to_pixel(lat, lon, center_lat, center_lon, zoom_level, output_size):
    """
    Convert lat/lon coordinates to pixel coordinates on a Google Maps image.

    Args:
        lat: Latitude in degrees
        lon: Longitude in degrees
        center_lat: Latitude of the center of the map in degrees
        center_lon: Longitude of the center of the map in degrees
        zoom_level: Google Maps zoom level
        output_size: Tuple of (width, height) for the output image

    Returns:
        Tuple of (pixel_x, pixel_y) coordinates on the image
    """
    # Google Maps uses Web Mercator projection
    # First, calculate world coordinates at this zoom level
    world_size = 256 * (2**zoom_level)

    # Calculate normalized x/y (0-1 across the world)
    norm_x = (lon + 180) / 360
    # Calculate normalized y using Web Mercator formula
    sin_lat = np.sin(np.radians(lat))
    norm_y = 0.5 - np.log((1 + sin_lat) / (1 - sin_lat)) / (4 * np.pi)

    # Calculate world pixel coordinates
    world_x = norm_x * world_size
    world_y = norm_y * world_size

    # Calculate center of the map in world coordinates
    center_x = (center_lon + 180) / 360 * world_size
    sin_center_lat = np.sin(np.radians(center_lat))
    center_y = (
        0.5 - np.log((1 + sin_center_lat) / (1 - sin_center_lat)) / (4 * np.pi)
    ) * world_size

    # Calculate pixel coordinates relative to our viewport
    pixel_x = int(world_x - center_x + output_size[0] / 2)
    pixel_y = int(world_y - center_y + output_size[1] / 2)

    return pixel_x, pixel_y


def create_anti_aliased_overlay(output_size, draw_func):
    """
    Creates an anti-aliased overlay by drawing at higher resolution and downsampling.

    Args:
        output_size: Tuple of (width, height) for the final image
        draw_func: Function that takes (image, draw, scale_factor)
        and performs the drawing

    Returns:
        The anti-aliased overlay image
    """
    # Create a larger image for smoother lines/shapes
    scale_factor = MapStyles.SCALE_FACTOR
    large_size = (output_size[0] * scale_factor, output_size[1] * scale_factor)
    smooth_overlay = Image.new("RGBA", large_size, (0, 0, 0, 0))
    smooth_draw = ImageDraw.Draw(smooth_overlay)

    # Call the provided drawing function
    draw_func(smooth_overlay, smooth_draw, scale_factor)

    # Resize back down with anti-aliasing
    return smooth_overlay.resize(output_size, Image.LANCZOS)


def generate_point_overlay(
    geom,
    output_size,
    zoom_level,
    radius_meters=MapDefaults.DEFAULT_POINT_RADIUS,
):
    """
    Generate a point image with a circle overlay.
    """
    if geom.geom_type != "Point":
        raise ValueError("Geometry must be a point")
    center_lon, center_lat = geom.x, geom.y

    # Convert point to pixel coordinates
    center_pixel_x, center_pixel_y = latlon_to_pixel(
        center_lat, center_lon, center_lat, center_lon, zoom_level, output_size
    )

    # Calculate pixel radius based on meters at this latitude
    # Each lower zoom level halves the resolution
    pixels_per_meter = MapStyles.POINT_PIXELS_PER_METER_AT_ZOOM_18 * (
        2 ** (zoom_level - 18)
    )
    radius_pixels = int(radius_meters * pixels_per_meter)

    # Ensure the radius is at least 10 pixels for visibility
    radius_pixels = max(radius_pixels, MapStyles.MIN_POINT_RADIUS_PIXELS)

    # Define a drawing function for our anti-aliased overlay
    def draw_circle(_, draw, scale_factor):
        # Scale up the coordinates
        scaled_center = (center_pixel_x * scale_factor, center_pixel_y * scale_factor)
        scaled_radius = radius_pixels * scale_factor

        # Draw a semi-transparent filled circle
        draw.ellipse(
            (
                scaled_center[0] - scaled_radius,
                scaled_center[1] - scaled_radius,
                scaled_center[0] + scaled_radius,
                scaled_center[1] + scaled_radius,
            ),
            fill=MapColors.FEATURE_HIGHLIGHT,  # Semi-transparent yellow fill
            outline=MapColors.FEATURE_OUTLINE,  # More opaque yellow outline
            width=scale_factor,  # Thicker line matching the polygon style
        )

    # Create the anti-aliased overlay
    return create_anti_aliased_overlay(output_size, draw_circle)


def generate_polygon_image(geom, output_size, zoom_level):
    """
    Generate a polygon image with a transparent overlay.
    For smoother edges the approach is to:
        - Creates a larger canvas (3x the original size)
        - Draws a thicker line (6px vs 3px) on this larger canvas
        - Resizes back down using LANCZOS resampling for anti-aliasing
        - The outline is also slightly more opaque (230 vs 200)
    """
    if geom.geom_type != "Polygon":
        raise ValueError("Geometry must be a polygon")

    center_lon, center_lat = calculate_geometry_center(geom)

    # Create a transparent overlay for the polygon
    overlay = Image.new("RGBA", output_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Convert polygon vertices to pixel coordinates
    pixel_coords = [
        latlon_to_pixel(lat, lon, center_lat, center_lon, zoom_level, output_size)
        for lon, lat in geom.exterior.coords
    ]

    # Draw the polygon with smoother, anti-aliased edges
    # 1. Draw a semi-transparent filled polygon
    draw.polygon(pixel_coords, fill=MapColors.FEATURE_FILL)

    # Define a drawing function for our anti-aliased outline
    def draw_polygon_outline(_, draw, scale_factor):
        # Scale up the coordinates
        scaled_coords = [(x * scale_factor, y * scale_factor) for x, y in pixel_coords]
        # Draw thicker line on larger canvas
        draw.line(
            scaled_coords + [scaled_coords[0]],
            fill=MapColors.FEATURE_OUTLINE,
            width=MapStyles.POLYGON_LINE_WIDTH,
        )

    # Create the anti-aliased overlay for the outline
    smooth_overlay = create_anti_aliased_overlay(output_size, draw_polygon_outline)

    # Combine the polygon fill and anti-aliased outline
    return Image.alpha_composite(overlay, smooth_overlay)


def combine_image_layers(*layers: Image.Image) -> Image.Image:
    """
    Combine multiple image layers using alpha compositing from bottom to top.

    Args:
        *layers: Any number of PIL Image objects in bottom-to-top order.
               The first image will be converted to RGBA mode if needed.

    Returns:
        A single combined PIL Image
    """
    if not layers:
        raise ValueError("At least one image layer is required")

    # Start with the bottom layer, ensuring it's in RGBA mode
    result = layers[0].convert("RGBA")

    # Composite each subsequent layer on top
    for layer in layers[1:]:
        result = Image.alpha_composite(result, layer)

    return result


def generate_deforestation_results_image(
    geojson_feature,
    tif_path,
    output_size=MapDefaults.OUTPUT_SIZE,
    padding_ratio=None,
    point_radius_meters=None,
):
    """
    Generate an image with a polygon or point drawn and deforestation areas overlayed
    on a Google Maps satellite image.
    """
    # Extract the feature's geometry type and validate parameters
    geom_type = geojson_feature["geometry"]["type"]
    validate_geometry_parameters(geom_type, point_radius_meters)

    # Use a smaller padding ratio for points
    if padding_ratio is None:
        if geom_type == "Point":
            padding_ratio = 0.1  # Less padding for points
        else:
            padding_ratio = MapDefaults.PADDING_RATIO

    # Extract the feature's geometry from GeoJSON
    geom = shape(geojson_feature["geometry"])

    # Generate the deforestation mask image
    mask_img = generate_deforestation_image(
        geom, tif_path, output_size, padding_ratio, point_radius_meters
    )

    # Calculate the zoom level
    zoom_level = calculate_zoom_level(
        geom, output_size, padding_ratio, point_radius_meters
    )

    # Generate the satellite image
    satellite_img = generate_satellite_image(geom, output_size, zoom_level)

    # Generate the appropriate overlay based on geometry type
    feature_img = GeometryHandler.create_feature_overlay(
        geom, output_size, zoom_level, point_radius_meters
    )

    # Combine all the layers in one go
    return combine_image_layers(satellite_img, mask_img, feature_img)
