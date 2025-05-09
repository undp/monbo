from PIL import Image
from rasterio.enums import Resampling


class GeographicConstants:
    """Universal geographic and mathematical constants for map calculations"""

    # Earth measurements
    EARTH_RADIUS_METERS = 6378137  # WGS84 equatorial radius in meters
    METERS_PER_DEGREE = 111320

    # Maximum/minimum values for Web Mercator projection
    MAX_LATITUDE = 85.0511  # Web Mercator projection limit
    MIN_LATITUDE = -85.0511  # Web Mercator projection limit


class MapDefaults:
    """Default parameters for map generation"""

    # Resampling methods
    RASTER_RESAMPLING = Resampling.nearest
    IMAGE_RESAMPLING = Image.LANCZOS

    # Map styling
    MAP_TYPE = "satellite"  # Options: satellite, roadmap, hybrid, terrain

    # Default dimensions (width, height) in pixels for generated map images
    OUTPUT_SIZE = (500, 500)

    # Extra padding ratio added around geometries to provide visual context
    PADDING_RATIO = 0.1

    # Default radius in meters when visualizing point geometries
    DEFAULT_POINT_RADIUS = 50  # meters

    # Multiplier applied to calculated zoom level for fine-tuning
    ZOOM_BOOST = 1.0

    # Maximum allowed zoom level for map tiles
    MAX_ZOOM = 20

    # Minimum allowed zoom level for map tiles
    MIN_ZOOM = 1


class MapColors:
    """
    Constants for map visualization colors and styling.
    All colors are in RGBA format (red, green, blue, alpha).
    """

    # Feature overlay colors for polygons and points
    FEATURE_FILL = (255, 235, 59, 40)  # Yellow fill with 16% opacity
    FEATURE_OUTLINE = (255, 235, 59, 230)  # Yellow outline with 90% opacity
    FEATURE_HIGHLIGHT = (255, 235, 59, 120)  # Yellow highlight with 47% opacity

    # Color used to highlight deforested areas
    DEFORESTATION = (255, 20, 20, 180)  # Red with 71% opacity

    # Color used as dark green background when satellite imagery is not available
    SOLID_BACKGROUND = (0, 64, 0)  # RGB for dark green


class MapStyles:
    """
    Constants for map visualization styling parameters.
    """

    # Anti-aliasing parameters for smoother rendering
    SCALE_FACTOR = 3  # Multiplier for temporary high-res rendering
    POLYGON_LINE_WIDTH = 6  # Width in pixels of polygon borders in scaled space

    # Parameters for point feature visualization
    MIN_POINT_RADIUS_PIXELS = 25  # Smallest allowed point radius in pixels

    # Updated to equatorial value at zoom level 18
    POINT_PIXELS_PER_METER_AT_ZOOM_18 = 1.675  # Pixels per meter conversion at zoom 18
