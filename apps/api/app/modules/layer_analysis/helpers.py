import asyncio

import geopandas as gpd
import mercantile
import numpy as np
import shapely
from fastapi import HTTPException
from PIL import Image
from rasterio.mask import mask

from app.utils.image_generation.loss_mask import render_loss_mask
from app.utils.image_generation.RasterDatasetCache import raster_dataset_cache


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
    """The z/x/y tile (256x256, RGBA) with the layer's loss pixels in red: each
    tile pixel takes the source pixel under its centre (see `render_loss_mask`)."""
    try:
        bounds = tuple(mercantile.xy_bounds(x, y, z))
        # Off the event loop, on a raster kept open between requests.
        loss = await asyncio.to_thread(
            raster_dataset_cache.read,
            tif_path,
            lambda raster: render_loss_mask(raster, bounds, 256, 256),
        )
        if loss is None:  # the tile is outside the raster
            return create_empty_tile()

        alpha = loss.astype(np.uint8) * 255
        rgba_data = np.zeros((256, 256, 4), dtype=np.uint8)
        rgba_data[..., 0] = alpha  # red
        rgba_data[..., 3] = alpha
        return Image.fromarray(rgba_data, mode="RGBA")
    except Exception as e:
        print(f"Error generating tile: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
