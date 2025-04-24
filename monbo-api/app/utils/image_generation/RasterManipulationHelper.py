from typing import Tuple
from shapely.geometry.base import BaseGeometry
import numpy as np
import asyncio
from PIL import Image
from pyproj import Transformer
from rasterio.transform import from_bounds
from app.utils.image_generation.constants import MapColors, MapDefaults
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.RasterDataContext import RasterDataContext
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper
from app.utils.image_generation.GeometryCalculator import GeometryCalculator


class RasterManipulationHelper:
    """
    A class for manipulating raster data.
    """

    @staticmethod
    async def generate_deforestation_image_from_bounds(
        geometry: BaseGeometry,
        tif_path: str,
        zoom_level: int,
        output_size: Tuple[int, int] = MapDefaults.OUTPUT_SIZE,
    ) -> Image.Image:
        """
        Generate a deforestation mask image aligned with Google Maps viewport bounds.

        Args:
            tif_path: Path to the TIF file containing deforestation data
            bounds: Tuple of (min_lat, min_lon, max_lat, max_lon) defining
                the viewport bounds
            output_size: Tuple of (width, height) for the output image size.
                Defaults to MapDefaults.OUTPUT_SIZE.

        Returns:
            PIL Image containing the deforestation mask with RGBA color values
                defined in MapColors.DEFORESTATION

        Raises:
            NoRasterDataOverlapError: If the requested viewport bounds do not
                overlap with the raster data
        """
        center_lat, center_lon = GeometryCalculator.calculate_geometry_center(geometry)

        # Get the actual bounds of the satellite image
        min_lat, max_lat, min_lon, max_lon = GoogleMapsAPIHelper.get_image_bounds(
            center_lat, center_lon, zoom_level, output_size
        )

        async with RasterDataContext(tif_path) as vrt:
            # Convert lat/lon bounds to the VRT's CRS (Web Mercator)
            transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

            # Transform bounds from WGS84 to Web Mercator
            # For Web Mercator, the coordinates should be (x=longitude, y=latitude)
            min_x, min_y = transformer.transform(min_lon, min_lat)
            max_x, max_y = transformer.transform(max_lon, max_lat)

            # Define the web mercator bounds for clipping - ensure correct ordering
            web_mercator_bounds = (
                min(min_x, max_x),  # minx
                min(min_y, max_y),  # miny
                max(min_x, max_x),  # maxx
                max(min_y, max_y),  # maxy
            )

            # Check if the bounds intersect with the VRT's bounds
            vrt_bounds = vrt.bounds
            if (
                (web_mercator_bounds[0] > vrt_bounds[2])  # minx > vrt.maxx
                or (web_mercator_bounds[2] < vrt_bounds[0])  # maxx < vrt.minx
                or (web_mercator_bounds[1] > vrt_bounds[3])  # miny > vrt.maxy
                or (web_mercator_bounds[3] < vrt_bounds[1])  # maxy < vrt.miny
            ):
                raise NoRasterDataOverlapError(
                    "The requested viewport does not overlap with the map's raster data"
                )

            # Get transform that maps between webmerc and image pixels
            # This ensures exact pixel alignment with Google Maps tiles
            dst_transform = from_bounds(
                web_mercator_bounds[0],
                web_mercator_bounds[1],
                web_mercator_bounds[2],
                web_mercator_bounds[3],
                output_size[0],
                output_size[1],
            )

            # Read the raster window
            data = await asyncio.to_thread(
                vrt.read,
                1,
                window=vrt.window(*web_mercator_bounds),
                out_shape=output_size[::-1],  # (height, width)
                resampling=MapDefaults.RASTER_RESAMPLING,
                # Use Google Maps alignment transform
                # This maps from destination pixels to web mercator space
                dst_transform=dst_transform,
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
