from fastapi import HTTPException
import numpy as np
from app.utils.json import read_json_file

import geopandas as gpd
import rasterio
from rasterio.mask import mask
from PIL import Image
from rasterio.vrt import WarpedVRT
import mercantile
from rasterio.enums import Resampling
from rasterio.errors import WindowError


def get_all_maps() -> list[dict]:
    """
    Retrieve a list of maps with specific attributes.
    This function reads a JSON file containing map data and returns a list of maps,
    each represented by a dictionary with the following attributes:
    - id: The unique identifier of the map.
    - name: The name of the map.
    - alias: An alias for the map.
    Returns:
        list[dict]: A list of dictionaries containing the 'id', 'name', and 'alias' of each map.
    """
    maps = read_json_file("app/maps/index.json")
    if maps is None:
        raise HTTPException(status_code=500, detail="Failed to read map data")

    return maps


def get_map_by_id(mapId: int) -> dict:
    """
    Retrieve a map by its ID.
    Args:
        mapId (int): The ID of the map to retrieve.
    Returns:
        dict: The map data corresponding to the provided ID.
    Raises:
        HTTPException: If no map with the given ID is found.
    This function reads from a JSON file containing map data and returns the map
    that matches the provided ID. If no such map is found, a 404 HTTP exception
    is raised with the message "Map not found".
    """
    maps = get_all_maps()

    requested_map = next(filter(lambda x: x["id"] == mapId, maps), None)
    return requested_map


def get_map_pixels_inside_polygon(polygon, map_asset):
    polygon_gdf = gpd.GeoDataFrame({"geometry": [polygon]}, crs="EPSG:4326")
    raster_crs = map_asset.crs
    polygon_gdf = polygon_gdf.to_crs(raster_crs)
    polygon_geometry = [polygon_gdf.geometry[0]]

    # Clip the raster to the polygon
    out_image, _ = mask(map_asset, polygon_geometry, crop=True)
    loss_year_data = out_image[0]  # Extract the first band

    return loss_year_data


def get_pixel_area(map_data):
    pixel_size = map_data["pixel_size"]  # Pixel size in meters
    return pixel_size * pixel_size  # Pixel area in square kilometers


def get_deforestation_percentage(pixels, polygon_area, pixel_area):
    deforested_pixels = np.equal(pixels, 1)
    deforested_pixels_sum = np.sum(deforested_pixels)
    deforested_area = float(deforested_pixels_sum * pixel_area)
    return deforested_area / polygon_area


def create_empty_tile():
    """Create a 256x256 transparent PNG tile."""
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))  # Transparent image
    return img


def get_tile(tif_path, z, x, y):
    """Dynamically extract and reproject a tile (PNG) for the specified z/x/y."""
    try:
        # Open the GeoTIFF
        with rasterio.open(tif_path) as src:
            # Define the target CRS (Google Maps uses EPSG:3857)
            target_crs = "EPSG:3857"

            # Create a Virtual Warped Dataset for the target projection
            with WarpedVRT(src, crs=target_crs) as vrt:
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
                data = vrt.read(
                    out_shape=(vrt.count, 256, 256),
                    window=window,
                    resampling=Resampling.nearest,  # Nearest neighbor preserves True/False
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
