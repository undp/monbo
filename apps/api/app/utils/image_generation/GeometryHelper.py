from typing import Optional, Tuple

from PIL import Image, ImageDraw
from pyproj import Transformer
from shapely.geometry import MultiPolygon, Point
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform

from app.config.logger import get_logger
from app.helpers.GeometryCalculator import GeometryCalculator
from app.utils.image_generation.constants import MapColors, MapDefaults, MapStyles
from app.utils.image_generation.errors import (
    GeometryTypeError,
    ParameterValidationError,
)
from app.utils.image_generation.GeoHelper import GeoHelper
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper
from app.utils.image_generation.ImageManipulationHelper import (
    ImageManipulationHelper,
)

# Get logger for this module
logger = get_logger("utils.image_generation.GeometryHelper")


# A farm's polygon geometries: a MultiPolygon is a farm of several parts
POLYGONAL_TYPES = ("Polygon", "MultiPolygon")


class GeometryHelper:
    """Handles processing for different geometry types."""

    @staticmethod
    def validate_geometry_parameters(
        geom_type: str,
        point_radius_meters: float | None = None,
    ) -> None:
        """
        Validate geometry parameters based on geometry type.

        Args:
            geom_type: The geometry type ("Polygon", "MultiPolygon", "Point", etc.)
            point_radius_meters: Radius parameter for Point geometries. Must be None
                for (Multi)Polygon geometries and required for Point geometries.

        Raises:
            ParameterValidationError: If point_radius_meters is provided for Polygon
                or missing for Point
            GeometryTypeError: If geometry type is not supported
        """
        logger.debug(
            "Validating geometry parameters: geom_type=%s, point_radius_meters=%s",
            geom_type,
            point_radius_meters,
        )

        if geom_type in POLYGONAL_TYPES:
            if point_radius_meters is not None:
                error_msg = (
                    "'point_radius_meters' parameter is not supported for "
                    f"{geom_type} geometries"
                )
                logger.error(error_msg)
                raise ParameterValidationError(error_msg)
        elif geom_type == "Point":
            if point_radius_meters is None:
                error_msg = (
                    "'point_radius_meters' parameter is required for Point geometries"
                )
                logger.error(error_msg)
                raise ParameterValidationError(error_msg)
        else:
            error_msg = f"Unsupported geometry type: '{geom_type}'"
            logger.error(error_msg)
            raise GeometryTypeError(error_msg)

        logger.debug("Geometry parameters validated successfully")

    @staticmethod
    def calculate_geometry_bounds(
        geom: BaseGeometry,
        point_radius_meters: Optional[float] = None,
    ) -> Tuple[float, float, float, float]:
        """
        Calculate the bounding box of a geometry (Polygon or Point).

        Args:
            geom: A shapely geometry object (Polygon or Point)
            point_radius_meters: For Point geometries, the radius in meters
                to create a boundary. Required for Point geometries, must be None
                for Polygon geometries.

        Returns:
            Tuple of (min_lat, max_lat, min_lon, max_lon) defining the bounding box

        Raises:
            ParameterValidationError: If point_radius_meters is provided for Polygon
                or missing for Point
            GeometryTypeError: If geometry type is not Polygon or Point
        """
        logger.debug(
            f"Calculating geometry bounds: geom_type={geom.geom_type}, "
            f"point_radius_meters={point_radius_meters}"
        )

        # Validate parameters
        GeometryHelper.validate_geometry_parameters(geom.geom_type, point_radius_meters)

        if geom.geom_type in POLYGONAL_TYPES:
            # Every part of the farm, so one image holds them all
            bounds_min_lon, bounds_min_lat, bounds_max_lon, bounds_max_lat = geom.bounds
            lons = (bounds_min_lon, bounds_max_lon)
            lats = (bounds_min_lat, bounds_max_lat)
        elif geom.geom_type == "Point":
            # Handle Point type - point_radius_meters already validated
            assert point_radius_meters is not None
            # Convert radius from meters to degrees
            radius_lat, radius_lon = GeoHelper.meters_to_degrees(
                point_radius_meters, geom.y
            )

            # Create bounds that include the radius around the point
            lons = (geom.x - radius_lon, geom.x + radius_lon)
            lats = (geom.y - radius_lat, geom.y + radius_lat)

        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)

        logger.debug(
            (
                f"Calculated geometry bounds: min_lat={min_lat}, max_lat={max_lat},"
                f"min_lon={min_lon}, max_lon={max_lon}"
            )
        )

        return min_lat, max_lat, min_lon, max_lon

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
                (default: EPSG:4326 - WGS84 lat/lon)
            target_crs: Target coordinate reference system
                (default: EPSG:3857 - Web Mercator)
            point_radius_meters: For Point geometries, the radius in meters
                               for buffering. Only applied when target_crs is EPSG:3857.

        Returns:
            BaseGeometry: The reprojected geometry. For Points with a radius in
                Web Mercator, returns a circular Polygon buffer around the point.

        Raises:
            GeometryTypeError: If geometry type is not Polygon or Point
        """
        logger.debug(
            f"Reprojecting geometry: geom_type={geom.geom_type}, "
            f"point_radius_meters={point_radius_meters}, "
            f"source_crs={source_crs}, target_crs={target_crs}"
        )

        # Validate geometry type and parameters
        GeometryHelper.validate_geometry_parameters(geom.geom_type, point_radius_meters)

        # Create transformer for the coordinate transformation
        transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)

        if geom.geom_type in POLYGONAL_TYPES:
            # Every part and hole, as (longitude, latitude)
            projected_geom = transform(transformer.transform, geom)

        if geom.geom_type == "Point":
            # For Point geometries, transform the point and optionally create a buffer
            x, y = transformer.transform(geom.x, geom.y)
            point_proj = Point(x, y)

            # If radius is provided, create a buffer (only makes sense in projected CRS)
            if target_crs == "EPSG:3857":
                projected_geom = point_proj.buffer(point_radius_meters)
            else:
                projected_geom = point_proj

        logger.debug("Reprojected geometry successfully")

        return projected_geom

    @staticmethod
    def _generate_point_overlay(
        geom: BaseGeometry,
        output_size: Tuple[int, int],
        zoom_level: int,
        radius_meters: float = MapDefaults.DEFAULT_POINT_RADIUS,
    ) -> Image.Image:
        """
        Generate a point image with a circle overlay.

        Args:
            geom: A shapely Point geometry
            output_size: Tuple of (width, height) in pixels for the output image
            zoom_level: Google Maps zoom level (1-20)
            radius_meters: Radius of the point circle in meters (default 50m)

        Returns:
            PIL Image with a semi-transparent circle overlay centered on the point
        """
        logger.debug(
            f"Generating point overlay: geom_type={geom.geom_type}, "
            f"output_size={output_size}, zoom_level={zoom_level}, "
            f"radius_meters={radius_meters}"
        )

        center_lon, center_lat = geom.x, geom.y

        # Get the actual bounds of the satellite image
        min_lat, max_lat, min_lon, max_lon = GoogleMapsAPIHelper.get_image_bounds(
            center_lat, center_lon, zoom_level, output_size
        )

        # Convert point to pixel coordinates
        # Instead of using the same center lat/lon for both the satellite image
        # and conversion, we now use the actual image bounds to calculate pixel
        # coordinates
        width, height = output_size

        # Calculate x pixel position based on longitude within image bounds
        x_ratio = (center_lon - min_lon) / (max_lon - min_lon)
        center_pixel_x = int(x_ratio * width)

        # Calculate y pixel position based on latitude within image bounds
        # Note: Latitude is inverted in pixel space (min_lat is at the bottom)
        y_ratio = 1.0 - (center_lat - min_lat) / (max_lat - min_lat)
        center_pixel_y = int(y_ratio * height)

        pixels_per_meter = GoogleMapsAPIHelper.calculate_pixels_per_meter(
            center_lat, zoom_level
        )

        radius_pixels = int(radius_meters * pixels_per_meter)

        # Ensure the radius is at least MIN_POINT_RADIUS_PIXELS for visibility
        radius_pixels = max(radius_pixels, MapStyles.MIN_POINT_RADIUS_PIXELS)

        # Define a drawing function for our anti-aliased overlay
        def draw_circle(
            _: Image.Image,
            draw: ImageDraw.ImageDraw,
            scale_factor: float,
        ) -> None:
            # Scale up the coordinates
            scaled_center = (
                center_pixel_x * scale_factor,
                center_pixel_y * scale_factor,
            )
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
                width=int(scale_factor),  # Thicker line matching the polygon style
            )

        # Create the anti-aliased overlay
        overlay = ImageManipulationHelper.create_anti_aliased_overlay(
            output_size, draw_circle
        )

        logger.debug("Generated point overlay successfully")

        return overlay

    @staticmethod
    def _generate_polygon_overlay(
        geom: BaseGeometry,
        output_size: Tuple[int, int],
        zoom_level: int,
    ) -> Image.Image:
        """
        Generate a polygon image with a transparent overlay.
        For smoother edges the approach is to:
            - Create a base transparent overlay for the polygon fill
            - Draw the semi-transparent polygon fill directly
            - Create a separate overlay for the anti-aliased outline by:
                - Drawing on a larger canvas (3x the original size)
                - Using a thicker line width
                - Resizing back down using LANCZOS resampling
            - Composite the fill and outline overlays together

        Args:
            geom: A shapely geometry object representing a polygon
            output_size: Tuple of (width, height) for the output image
            zoom_level: Google Maps zoom level

        Returns:
            PIL Image with the polygon overlay
        """
        logger.debug(
            f"Generating polygon overlay: geom_type={geom.geom_type}, "
            f"output_size={output_size}, zoom_level={zoom_level}"
        )

        center_lat, center_lon = GeometryCalculator.calculate_geometry_center(geom)

        # Get the actual bounds of the satellite image
        min_lat, max_lat, min_lon, max_lon = GoogleMapsAPIHelper.get_image_bounds(
            center_lat, center_lon, zoom_level, output_size
        )
        logger.debug(f"Image bounds: {min_lat}, {max_lat}, {min_lon}, {max_lon}")

        # Convert every ring's vertices to pixel coordinates using image bounds
        width, height = output_size

        def to_pixels(ring) -> list[Tuple[int, int]]:
            pixel_coords = []
            for lon, lat, *_ in ring.coords:
                # x from the longitude within the image bounds
                x_ratio = (lon - min_lon) / (max_lon - min_lon)
                # y from the latitude, inverted in pixel space (min_lat at the bottom)
                y_ratio = 1.0 - (lat - min_lat) / (max_lat - min_lat)
                pixel_coords.append((int(x_ratio * width), int(y_ratio * height)))
            return pixel_coords

        polygons = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
        parts = [
            (
                to_pixels(polygon.exterior),
                [to_pixels(hole) for hole in polygon.interiors],
            )
            for polygon in polygons
        ]
        exteriors = [exterior for exterior, _ in parts]
        holes = [hole for _, part_holes in parts for hole in part_holes]

        # 1. The semi-transparent fill, through a mask: PIL can't fill a polygon
        # with holes, so each part is its exterior filled and then its holes
        # cleared. Parts are masked one at a time and joined: a valid farm can
        # have a part inside another part's hole, which that hole must not erase
        mask = Image.new("L", output_size, 0)
        for exterior, part_holes in parts:
            part_mask = Image.new("L", output_size, 0)
            part_draw = ImageDraw.Draw(part_mask)
            part_draw.polygon(exterior, fill=255)
            for hole in part_holes:
                part_draw.polygon(hole, fill=0)
            mask.paste(255, mask=part_mask)
        overlay = Image.composite(
            Image.new("RGBA", output_size, MapColors.FEATURE_FILL),
            Image.new("RGBA", output_size, (0, 0, 0, 0)),
            mask,
        )

        # Define a drawing function for our anti-aliased outline
        def draw_polygon_outline(
            _: Image.Image,
            draw: ImageDraw.ImageDraw,
            scale_factor: float,
        ) -> None:
            # Every exterior and hole is outlined
            for ring in exteriors + holes:
                # Scale up the coordinates
                scaled_coords = [(x * scale_factor, y * scale_factor) for x, y in ring]
                # Draw thicker line on larger canvas
                draw.line(
                    scaled_coords + [scaled_coords[0]],
                    fill=MapColors.FEATURE_OUTLINE,
                    width=MapStyles.POLYGON_LINE_WIDTH,
                )

        # Create the anti-aliased overlay for the outline
        smooth_overlay = ImageManipulationHelper.create_anti_aliased_overlay(
            output_size, draw_polygon_outline
        )

        # Combine the polygon fill and anti-aliased outline
        overlay = Image.alpha_composite(overlay, smooth_overlay)

        logger.debug("Generated polygon overlay successfully")

        return overlay

    @staticmethod
    def create_feature_overlay(
        geom: BaseGeometry,
        output_size: Tuple[int, int],
        zoom_level: int,
        point_radius_meters: Optional[float] = None,
    ) -> Image.Image:
        """
        Create appropriate feature overlay based on geometry type.

        Args:
            geom: A shapely geometry object (currently supports Polygon and Point types)
            output_size: Tuple of (width, height) for the output image
            zoom_level: Google Maps zoom level
            point_radius_meters: For Point geometries, the radius in meters.
                Required when geom is a Point.

        Returns:
            PIL Image with the feature overlay

        Raises:
            ParameterValidationError: If point_radius_meters is provided for Polygon
                or missing for Point
            GeometryTypeError: If geometry type is not supported (Polygon or Point)
        """
        GeometryHelper.validate_geometry_parameters(geom.geom_type, point_radius_meters)

        if geom.geom_type in POLYGONAL_TYPES:
            overlay = GeometryHelper._generate_polygon_overlay(
                geom, output_size, zoom_level
            )

        if geom.geom_type == "Point":
            assert point_radius_meters is not None
            overlay = GeometryHelper._generate_point_overlay(
                geom, output_size, zoom_level, point_radius_meters
            )

        logger.debug("Generated feature overlay successfully")
        return overlay
