from typing import Tuple
from PIL import Image
from shapely.geometry.base import BaseGeometry
from app.utils.image_generation.constants import MapDefaults
from app.utils.image_generation.GeometryHelper import GeometryHelper
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper
from app.utils.image_generation.ImageManipulationHelper import ImageManipulationHelper
from app.utils.image_generation.RasterManipulationHelper import (
    RasterManipulationHelper,
)
from app.utils.image_generation.errors import (
    NoRasterDataOverlapError,
    MapGenerationError,
)


# """
# The only meaningful improvements that might still be worth considering:
# - Caching for expensive operations: If you're calling functions like
#     calculate_zoom_level repeatedly with the same parameters, implementing caching
#     could improve performance.
# - Comprehensive test suite: Adding unit and integration tests would help ensure
#     the code works as expected and prevent regressions
# """


class MapImageGenerator:
    """
    Coordinates the generation of composite map images with satellite imagery,
    polygon overlays, and raster data visualization.
    """

    @staticmethod
    async def generate(
        geometry: BaseGeometry,
        tif_path: str,
        point_radius_meters: float = None,
        output_size: Tuple[int, int] = MapDefaults.OUTPUT_SIZE,
    ) -> Image.Image:
        """
        Generate a composite map with Google Maps satellite imagery as base,
        a geometry overlay (polygon or point), and optionally deforestation data.

        Args:
            geometry: Shapely geometry object (Polygon or Point). Must be in WGS84
                coordinate system (EPSG:4326).
            tif_path: Optional path to TIF file with deforestation data. If provided,
                will attempt to overlay deforestation data from this file.
            point_radius_meters: Radius for Point geometries in meters. Required if
                geometry is a Point, must be None for Polygon geometries.
            output_size: Output image dimensions as (width, height) tuple in pixels.
                Defaults to MapDefaults.OUTPUT_SIZE.

        Returns:
            PIL Image with composited layers in RGBA mode. The layers are composited
            in order: satellite imagery (bottom), geometry overlay, deforestation data
            (if available, top).

        Raises:
            GeometryTypeError: If geometry is not a Polygon or Point
            ParameterValidationError: If point_radius_meters is provided for Polygon
                or missing for Point geometries
            GoogleMapsAPIError: If there are issues fetching satellite imagery
        """
        layers: list[Image.Image] = []
        # Get the geometry bounds and calculate zoom level
        min_lat, max_lat, min_lon, max_lon = GeometryHelper.calculate_geometry_bounds(
            geometry, point_radius_meters
        )

        zoom_level = GoogleMapsAPIHelper.calculate_zoom_from_bounds(
            min_lat, max_lat, min_lon, max_lon, output_size
        )

        # Get the satellite base image
        satellite_img = await GoogleMapsAPIHelper.get_google_maps_satellite_image(
            geometry, zoom_level, output_size
        )
        layers.append(satellite_img)

        # Create geometry overlay
        geometry_overlay = GeometryHelper.create_feature_overlay(
            geometry, output_size, zoom_level, point_radius_meters
        )
        layers.append(geometry_overlay)

        # Generate deforestation image
        try:
            deforestation_overlay = (
                await (
                    RasterManipulationHelper.generate_deforestation_image_from_bounds(
                        geometry,
                        tif_path,
                        zoom_level,
                        output_size,
                    )
                )
            )
            layers.append(deforestation_overlay)
        except NoRasterDataOverlapError:
            # Simply don't add the layer, but don't interrupt the process
            pass
        except Exception as e:
            # Re-raise with more context
            raise MapGenerationError(
                f"Error processing deforestation data: {str(e)}"
            ) from e

        # Combine all layers
        return ImageManipulationHelper.combine_image_layers(*layers)
