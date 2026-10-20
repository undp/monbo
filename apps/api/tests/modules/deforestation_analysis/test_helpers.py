import asyncio
from unittest.mock import MagicMock, patch

import mercantile
import numpy as np
import pyproj
import pytest
from fastapi import HTTPException
from PIL import Image
from rasterio.errors import WindowError
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from shapely import box
from shapely.ops import transform as transform_geometry

from app.modules.deforestation_analysis.helpers import (
    create_empty_tile,
    get_loss_area_fraction,
    get_tile,
)
from app.modules.maps.helpers import get_all_maps, get_map_by_id


class _AsyncRasterContext:
    """Minimal async context manager standing in for RasterDataContext."""

    def __init__(self, vrt):
        self._vrt = vrt

    async def __aenter__(self):
        return self._vrt

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False


def test_get_all_maps(maps_root):
    maps_root.write_index(
        [
            {"id": 1, "name": "Deforestation Map A"},
            {"id": 2, "name": "Deforestation Map B", "enabled": False, "version": 4},
        ]
    )
    response = get_all_maps()
    assert response == [
        {
            "id": 1,
            "name": "Deforestation Map A",
            "enabled": True,
            "version": 1,
            "country": None,
        },
        {
            "id": 2,
            "name": "Deforestation Map B",
            "enabled": False,
            "version": 4,
            "country": None,
        },
    ]

    (maps_root.root / "index.json").unlink()
    with pytest.raises(HTTPException):
        get_all_maps()


@patch("app.modules.maps.helpers.get_all_maps")
def test_get_map_by_id(mock_get_all_maps):
    mock_data = [
        {"id": 1, "name": "Deforestation Map A"},
        {"id": 2, "name": "Deforestation Map B"},
    ]
    mock_get_all_maps.return_value = mock_data
    response = get_map_by_id(1)
    assert response == mock_data[0]

    response = get_map_by_id(2)
    assert response == mock_data[1]

    response = get_map_by_id(3)
    assert response is None


def test_create_empty_tile():
    response = create_empty_tile()
    assert response == Image.new("RGBA", (256, 256), (0, 0, 0, 0))


# Synthetic layers of 4 x 4 pixels: one in EPSG:4326 (pixels of 0.00027°, as GFW
# and TMF) and one in UTM 17S (30 m, as the MAATE layers), both in Ecuador.
LAYERS = {
    "EPSG:4326": (-79.0, -1.0, 0.00027),
    "EPSG:32717": (700_000.0, 9_890_000.0, 30.0),
}


@pytest.fixture(params=list(LAYERS), ids=["EPSG:4326", "UTM"])
def layer(request):
    """Opens a 4 x 4 layer whose loss pixels are given as (row, col)."""
    crs = request.param
    west, north, size = LAYERS[crs]
    to_wgs84 = pyproj.Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    files = []

    def open_layer(loss_pixels):
        data = np.zeros((4, 4), dtype=np.uint8)
        for row, col in loss_pixels:
            data[row, col] = 1
        memfile = MemoryFile()
        files.append(memfile)
        with memfile.open(
            driver="GTiff",
            width=4,
            height=4,
            count=1,
            dtype="uint8",
            crs=crs,
            transform=from_origin(west, north, size, size),
        ) as dst:
            dst.write(data, 1)
        return memfile.open()

    def polygon(col_min, row_min, col_max, row_max):
        """A box in pixel units (columns east, rows south), in EPSG:4326."""
        shape = box(
            west + col_min * size,
            north - row_max * size,
            west + col_max * size,
            north - row_min * size,
        )
        return transform_geometry(to_wgs84.transform, shape.segmentize(size / 8))

    yield open_layer, polygon
    for memfile in files:
        memfile.close()


@pytest.mark.parametrize(
    ("loss_pixels", "pixel_box", "expected"),
    [
        pytest.param([(0, 0), (0, 1)], (0, 0, 2, 2), 0.5, id="2 of 4 pixels"),
        pytest.param([], (0, 0, 2, 2), 0.0, id="no loss"),
        pytest.param([(1, 1)], (0, 0, 4, 4), 1 / 16, id="1 of 16 pixels"),
        # Half of the loss pixel (0, 2) next to 4 pixels without loss
        pytest.param([(0, 2), (1, 2)], (0, 0, 2.5, 2), 1 / 5, id="half a loss pixel"),
        # 1% of a loss pixel: a whole pixel would be 1 / 4.01, above the threshold
        pytest.param([(0, 2)], (0, 0, 2.01, 2), 0.01 / 4.02, id="edge sliver"),
        pytest.param(
            [(1, 1)], (1.25, 1.25, 1.75, 1.75), 1.0, id="sub-pixel, inside loss"
        ),
        pytest.param(
            [(1, 1)], (1.75, 1.25, 2.25, 1.75), 0.5, id="sub-pixel, half on loss"
        ),
        pytest.param(
            [(r, c) for r in range(4) for c in range(4)],
            (0, 0, 4, 4),
            1.0,
            id="all loss",
        ),
    ],
)
def test_get_loss_area_fraction(layer, loss_pixels, pixel_box, expected):
    open_layer, polygon = layer
    with open_layer(loss_pixels) as src:
        result = get_loss_area_fraction(polygon(*pixel_box), src)
    assert result == pytest.approx(expected, abs=1e-6)
    assert 0.0 <= result <= 1.0


def test_get_loss_area_fraction_outside_the_raster(layer):
    open_layer, polygon = layer
    with open_layer([(0, 0)]) as src, pytest.raises(ValueError):
        get_loss_area_fraction(polygon(10, 10, 12, 12), src)


@patch("app.modules.deforestation_analysis.helpers.RasterDataContext")
@patch("app.modules.deforestation_analysis.helpers.mercantile.xy_bounds")
def test_get_tile(mock_xy_bounds, mock_raster_context):
    # get_tile is an async coroutine with signature (tif_path, z, x, y). It opens
    # the raster through RasterDataContext (an async context manager) and renders
    # a 256x256 RGBA PNG tile for the requested z/x/y.
    tif_path = "app/maps/layers/rasters/example.tif"
    z, x, y = 10, 500, 300  # Tile coordinates

    # Mock the warped VRT exposed by RasterDataContext.__aenter__
    mock_vrt = MagicMock()
    mock_vrt.count = 1  # Single-band raster
    mock_vrt.bounds = mercantile.Bbox(-180, -90, 180, 90)  # Global coverage
    mock_vrt.window.return_value = mercantile.Bbox(0, 0, 10, 10)  # Mock window
    mock_vrt.read.return_value = np.random.randint(0, 2, (1, 256, 256), dtype=np.uint8)

    mock_raster_context.return_value = _AsyncRasterContext(mock_vrt)

    mock_xy_bounds.return_value = mercantile.Bbox(
        left=-45, bottom=-45, right=45, top=45
    )

    # Call function
    result = asyncio.run(get_tile(tif_path, z, x, y))

    # Assertions
    assert isinstance(result, Image.Image)  # Ensure return type is PIL Image
    assert result.size == (256, 256)  # Ensure correct size
    assert result.mode == "RGBA"  # Ensure correct mode
    mock_raster_context.assert_called_once_with(tif_path)  # Ensure raster opened
    mock_xy_bounds.assert_called_once_with(x, y, z)  # Ensure tile bounds checked

    # Multi-band data: only the first band is used
    mock_vrt.read.return_value = np.random.randint(0, 2, (2, 256, 256), dtype=np.uint8)
    result = asyncio.run(get_tile(tif_path, z, x, y))

    # Assertions
    assert isinstance(result, Image.Image)  # Ensure return type is PIL Image
    assert result.size == (256, 256)  # Ensure correct size
    assert result.mode == "RGBA"  # Ensure correct mode

    # Simulate a case where the tile is outside bounds
    mock_vrt.bounds = mercantile.Bbox(60, 60, 70, 70)  # Change bounds to exclude tile
    result_empty = asyncio.run(get_tile(tif_path, z, x, y))
    assert result_empty == Image.new(
        "RGBA", (256, 256), (0, 0, 0, 0)
    )  # Ensure empty tile returned

    # Simulate a window calculation failure
    mock_vrt.bounds = mercantile.Bbox(-180, -90, 180, 90)  # Global coverage
    mock_vrt.window.side_effect = WindowError("Invalid window")
    mock_window_error = asyncio.run(get_tile(tif_path, z, x, y))
    assert mock_window_error == Image.new("RGBA", (256, 256), (0, 0, 0, 0))

    # Simulate Exception
    mock_vrt.window.side_effect = OSError("Invalid window")
    with pytest.raises(HTTPException):
        asyncio.run(get_tile(tif_path, z, x, y))
