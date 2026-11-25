"""Loss pixels drawn onto a Web Mercator grid: the map's tiles and the report's
images. Each output pixel takes the value of the source pixel under its centre,
reprojected in one step from the raster (or an overview) onto the output's own
grid, so a loss pixel's edges are drawn where the raster puts them."""

from typing import TYPE_CHECKING, Sequence

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds

if TYPE_CHECKING:
    from app.utils.image_generation.RasterDatasetCache import CachedRaster

WEB_MERCATOR = "EPSG:3857"

Bounds = tuple[float, float, float, float]


def source_level(
    resolution: float, overview_factors: Sequence[int], output_pixel: float
) -> int | None:
    """The overview to read: the coarsest whose pixel is still no larger than an
    output pixel, or None for the full resolution. Its grid decimates the source's,
    so its pixels stay aligned with it; and at the zooms where alignment shows (a
    source pixel spans several output pixels) no overview is that fine."""
    level = None
    for index, factor in enumerate(overview_factors):
        if resolution * factor <= output_pixel:
            level = index
    return level


def render_loss_mask(
    raster: "CachedRaster", bounds: Bounds, width: int, height: int
) -> np.ndarray | None:
    """The loss pixels (value 1) of `raster` on a `width` x `height` grid over
    `bounds` (EPSG:3857), as booleans; None when the bounds miss the raster."""
    left, bottom, right, top = bounds
    r_left, r_bottom, r_right, r_top = raster.bounds_3857
    if left >= r_right or right <= r_left or bottom >= r_top or top <= r_bottom:
        return None

    src = raster.src
    s_left, s_bottom, s_right, s_top = transform_bounds(WEB_MERCATOR, src.crs, *bounds)
    output_pixel = min((s_right - s_left) / width, (s_top - s_bottom) / height)
    level = source_level(max(src.res), src.overviews(1), output_pixel)

    # Outside the raster and on nodata the output keeps a value other than 1.
    out = np.zeros((height, width), dtype=np.uint8)
    reproject(
        rasterio.band(raster.dataset(level), 1),
        out,
        dst_transform=from_bounds(left, bottom, right, top, width, height),
        dst_crs=WEB_MERCATOR,
        # GDAL's default approximation of the transform. Exact (`tolerance=0`)
        # costs 5x per tile in UTM, and only moves output pixels whose centre is
        # within ~0.0004 of a source pixel (1 cm at 30 m) from its edge.
        resampling=Resampling.nearest,
    )
    return out == 1
