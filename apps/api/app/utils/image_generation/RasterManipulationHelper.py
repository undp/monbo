import asyncio
from typing import Tuple

import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely.geometry.base import BaseGeometry

from app.helpers.GeometryCalculator import GeometryCalculator
from app.utils.image_generation.constants import MapColors, MapDefaults
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper
from app.utils.image_generation.loss_mask import render_loss_mask
from app.utils.image_generation.RasterDatasetCache import raster_dataset_cache


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

        # The image's grid is in Web Mercator, like the satellite image's
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

        # Off the event loop, on a raster kept open between requests.
        loss = await asyncio.to_thread(
            raster_dataset_cache.read,
            tif_path,
            lambda raster: render_loss_mask(raster, web_mercator_bounds, *output_size),
        )
        if loss is None:
            raise NoRasterDataOverlapError(
                "The requested viewport does not overlap with the map's raster data"
            )

        # Create deforestation mask using the defined colors
        mask_data = loss.astype(np.uint8)
        rgba_data = np.zeros((output_size[1], output_size[0], 4), dtype=np.uint8)
        rgba_data[..., 0] = mask_data * MapColors.DEFORESTATION[0]
        rgba_data[..., 1] = mask_data * MapColors.DEFORESTATION[1]
        rgba_data[..., 2] = mask_data * MapColors.DEFORESTATION[2]
        rgba_data[..., 3] = mask_data * MapColors.DEFORESTATION[3]

        mask_img = Image.fromarray(rgba_data, mode="RGBA")
        return mask_img
