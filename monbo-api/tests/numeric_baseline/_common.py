"""Shared fixture inputs and analysis pipeline for the numpy 2 numeric gate.

Both the baseline-capture script (``generate_baseline.py``) and the pytest gate
(``tests/test_numeric_baseline.py``) import this module so the exact same code
path is exercised when capturing the reference values (under the pre-upgrade
numpy 1 environment) and when validating them (under the committed numpy 2
lock). Everything here is fully deterministic: the raster, the analysis
geometry and the scalar inputs are fixed, with no network, clock or mutable
external-data dependency.
"""

import asyncio
from pathlib import Path

import geopandas as gpd
import mercantile
import numpy as np
import rasterio
from rasterio.mask import mask as rio_mask
from rasterio.transform import from_bounds

from app.helpers.GeometryCalculator import GeometryCalculator
from app.models.polygons import Coordinates
from app.modules.deforestation_analysis.helpers import (
    get_deforestation_ratio,
    get_map_pixels_inside_polygon,
    get_pixel_area,
    get_tile,
)
from app.utils.polygons import generate_polygon

# --- Fixture location ------------------------------------------------------
# A small 64x64 EPSG:4326 raster over a fixed box (~0.04 deg near lng/lat
# -70/-5). Pixel value 1 == forest loss, 0 == no loss, 255 == nodata.
FIXTURE_DIR = Path(__file__).parent
RASTER_PATH = FIXTURE_DIR / "fixture.tif"
BASELINE_JSON = FIXTURE_DIR / "baseline.json"
BASELINE_RASTER = FIXTURE_DIR / "baseline_raster.npz"
BASELINE_TILE = FIXTURE_DIR / "baseline_tile.png"

WEST, SOUTH, EAST, NORTH = -70.02, -5.02, -69.98, -4.98
WIDTH = HEIGHT = 64
NODATA = 255

# Metadata pixel size (meters) used by the deforestation math, mirroring the
# real map index (pixel_size == 30 -> 900 m^2 per pixel).
MAP_DATA = {"pixel_size": 30}

# Fixed analysis polygon (lng, lat) fully inside the raster, covering the
# central loss block.
ANALYSIS_POLYGON = [
    (-70.012, -5.012),
    (-70.012, -4.988),
    (-69.988, -4.988),
    (-69.988, -5.012),
]

# Deterministic inputs for the pure scalar-ratio check.
SCALAR_PIXELS = [1, 0, 3, 1, 0, 2, 0, 0, 1, 3]
SCALAR_POLYGON_AREA = 100.0
SCALAR_PIXEL_AREA = 5.0

# Rendered-imagery tile, chosen to overlap the fixture so the tile is non-empty.
_TILE_ZOOM = 14
_center = mercantile.tile((WEST + EAST) / 2, (SOUTH + NORTH) / 2, _TILE_ZOOM)
TILE_ZXY = (_TILE_ZOOM, _center.x, _center.y)


def fixture_pixels() -> np.ndarray:
    """Deterministic single-band loss pattern (no randomness).

    Pixel values: ``1`` == forest loss, ``0`` == no loss, ``255`` == nodata.
    The nodata block sits *inside* the analysis polygon, so after the crop the
    baseline's valid mask contains both True (valid) and False (nodata) cells.
    Without it the raster is pure 0/1 and, because the analysis polygon covers a
    full pixel-aligned rectangle, ``valid_mask`` would be 100% True and the
    nodata/valid-mask comparison path in the gate would never be exercised.
    """
    data = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
    data[16:48, 16:48] = 1  # central loss block
    data[20:28, 20:28] = NODATA  # nodata hole carved inside the loss block
    data[4, 4] = 1  # scattered loss pixels
    data[60, 60] = 1
    return data


def create_fixture_raster(path: Path) -> None:
    """Write the version-controlled synthetic GeoTIFF fixture."""
    transform = from_bounds(WEST, SOUTH, EAST, NORTH, WIDTH, HEIGHT)
    profile = {
        "driver": "GTiff",
        "height": HEIGHT,
        "width": WIDTH,
        "count": 1,
        "dtype": "uint8",
        "crs": "EPSG:4326",
        "transform": transform,
        "nodata": NODATA,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(fixture_pixels(), 1)


def compute_outputs(raster_path: Path) -> dict:
    """Run the deforestation pipeline over the fixture and collect outputs.

    Returns the scalar deforestation ratios, the masked-raster array with its
    metadata/valid-mask, and the decoded rendered tile image.
    """
    coords = [Coordinates(lng=lng, lat=lat) for lng, lat in ANALYSIS_POLYGON]
    polygon = generate_polygon(coords, None)

    with rasterio.open(raster_path) as src:
        # Scalar path exercises the real helper used in production.
        loss_year_data = get_map_pixels_inside_polygon(polygon, src)

        # Full masked raster (all bands) + transform for the raster gate,
        # mirroring get_map_pixels_inside_polygon's masking.
        polygon_gdf = gpd.GeoDataFrame({"geometry": [polygon]}, crs="EPSG:4326").to_crs(
            src.crs
        )
        geom = [polygon_gdf.geometry.iloc[0]]
        out_image, out_transform = rio_mask(src, geom, crop=True, all_touched=True)
        crs = src.crs.to_string()
        count = int(src.count)
        nodata = src.nodata

    pixel_area = get_pixel_area(MAP_DATA)
    polygon_area = GeometryCalculator.calculate_polygon_area(polygon)
    scalar_ratio = get_deforestation_ratio(loss_year_data, polygon_area, pixel_area)
    scalar_ratio_pure = get_deforestation_ratio(
        np.array(SCALAR_PIXELS), SCALAR_POLYGON_AREA, SCALAR_PIXEL_AREA
    )

    if nodata is not None:
        valid_mask = np.asarray(out_image != nodata)
    else:
        valid_mask = np.ones_like(out_image, dtype=bool)

    z, x, y = TILE_ZXY
    tile_image = asyncio.run(get_tile(str(raster_path), z, x, y))

    return {
        "scalar_ratio": float(scalar_ratio),
        "scalar_ratio_pure": float(scalar_ratio_pure),
        "polygon_area": float(polygon_area),
        "raster": {
            "pixels": np.asarray(out_image),
            "transform": [float(v) for v in tuple(out_transform)[:6]],
            "crs": crs,
            "count": count,
            "dtype": str(out_image.dtype),
            "nodata": None if nodata is None else float(nodata),
            "valid_mask": valid_mask,
        },
        "tile_image": tile_image,
    }
