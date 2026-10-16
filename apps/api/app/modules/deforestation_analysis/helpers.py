import asyncio

import geopandas as gpd
import mercantile
import numpy as np
import shapely
from fastapi import HTTPException
from PIL import Image
from rasterio.enums import Resampling
from rasterio.errors import WindowError
from rasterio.mask import mask

from app.utils.image_generation.RasterDataContext import RasterDataContext


def get_loss_area_fraction(polygon, src) -> float:
    """The share of the polygon's area that lies on loss pixels (value 1).

    Each loss pixel counts by the area of its intersection with the polygon, so a
    pixel the polygon only grazes adds that sliver and not a whole pixel. Both areas
    are measured in the raster's CRS: exact in a projected one, and in EPSG:4326 the
    ratio of two areas a few hundred metres across is the same as on the ground.
    Raises ValueError (from `mask`) when the polygon is outside the raster.
    """
    geometry = gpd.GeoSeries([polygon], crs="EPSG:4326").to_crs(src.crs).iloc[0]
    # all_touched: the window must hold every pixel the polygon overlaps, also those
    # it only grazes. Pixels outside it are filled, so they never read as loss.
    out_image, transform = mask(src, [geometry], crop=True, all_touched=True)
    rows, cols = np.nonzero(out_image[0] == 1)
    if len(rows) == 0 or geometry.area <= 0:
        return 0.0
    # Each loss pixel's corners, from the window's affine transform.
    corners = [
        transform * (cols + dc, rows + dr)
        for dc, dr in ((0, 0), (1, 0), (1, 1), (0, 1))
    ]
    squares = shapely.polygons(
        np.stack([np.column_stack(corner) for corner in corners], axis=1)
    )
    loss_area = shapely.area(shapely.intersection(squares, geometry)).sum()
    # Clamped against floating point at the pixels' edges
    return min(1.0, max(0.0, float(loss_area / geometry.area)))


def create_empty_tile():
    """Create a 256x256 transparent PNG tile."""
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))  # Transparent image
    return img


async def get_tile(tif_path, z, x, y):
    """Dynamically extract and reproject a tile (PNG) for the specified z/x/y."""
    try:
        # Open the GeoTIFF
        async with RasterDataContext(tif_path) as vrt:
            # Get tile bounds in the target CRS
            bounds = mercantile.xy_bounds(x, y, z)

            # Check if the tile bounds overlap the GeoTIFF's bounds
            tif_bounds = vrt.bounds
            if (
                bounds.right < tif_bounds.left  # Tile is left of the GeoTIFF
                or bounds.left > tif_bounds.right  # Tile is right of the GeoTIFF
                or bounds.top < tif_bounds.bottom  # Tile is below the GeoTIFF
                or bounds.bottom > tif_bounds.top  # Tile is above the GeoTIFF
            ):
                return create_empty_tile()

            # Calculate the raster window for the requested bounds
            window = vrt.window(bounds.left, bounds.bottom, bounds.right, bounds.top)

            # Read the data for the specified window, resampled to 256x256 pixels
            data = await asyncio.to_thread(
                vrt.read,
                out_shape=(vrt.count, 256, 256),
                window=window,
                # Nearest neighbor preserves True/False
                resampling=Resampling.nearest,
            )

            # Select the first band if there are multiple bands
            if data.shape[0] > 1:
                data = data[0]  # Use the first band
            else:
                data = data.squeeze()  # Flatten single-band data

            # Convert data to a binary mask (True/False)
            mask = np.equal(data, 1).astype(np.uint8)  # 1 for True, 0 for False

            # Create an RGBA array
            rgba_data = np.zeros((256, 256, 4), dtype=np.uint8)
            rgba_data[..., 0] = mask * 255  # Red channel (255 if True)
            rgba_data[..., 3] = mask * 255  # Alpha channel (255 if True)

            # Create a PIL Image
            img = Image.fromarray(rgba_data, mode="RGBA")
            return img
    except WindowError:
        # If the window calculation fails, return an empty tile
        return create_empty_tile()
    except Exception as e:
        print(f"Error generating tile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
