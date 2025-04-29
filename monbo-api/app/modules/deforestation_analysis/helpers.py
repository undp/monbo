import geopandas as gpd
import mercantile
import asyncio
import numpy as np
from fastapi import HTTPException
from PIL import Image
from rasterio.enums import Resampling
from rasterio.errors import WindowError
from rasterio.mask import mask
from app.utils.image_generation.RasterDataContext import RasterDataContext


def get_map_pixels_inside_polygon(polygon, map_asset):
    polygon_gdf = gpd.GeoDataFrame({"geometry": [polygon]}, crs="EPSG:4326")
    raster_crs = map_asset.crs
    polygon_gdf = polygon_gdf.to_crs(raster_crs)
    polygon_geometry = [polygon_gdf.geometry[0]]

    # Clip the raster to the polygon
    out_image, _ = mask(map_asset, polygon_geometry, crop=True, all_touched=True)
    loss_year_data = out_image[0]  # Extract the first band

    return loss_year_data


def get_pixel_area(map_data):
    pixel_size = map_data["pixel_size"]  # Pixel size in meters
    return pixel_size * pixel_size  # Pixel area in square kilometers


def get_deforestation_ratio(pixels, polygon_area, pixel_area):
    if polygon_area == 0:
        return 0
    deforested_pixels = np.equal(pixels, 1)
    deforested_pixels_sum = np.sum(deforested_pixels)
    deforested_area = float(deforested_pixels_sum * pixel_area)
    return min(1.0, deforested_area / polygon_area)


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
            window = vrt.window(
                bounds.left, bounds.bottom, bounds.right, bounds.top, precision=21
            )

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
