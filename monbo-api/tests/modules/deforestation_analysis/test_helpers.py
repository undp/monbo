import asyncio
from unittest.mock import MagicMock, patch

import mercantile
import numpy as np
import pytest
from fastapi import HTTPException
from PIL import Image
from rasterio.errors import WindowError
from shapely import Polygon

from app.modules.deforestation_analysis.helpers import (
    create_empty_tile,
    get_deforestation_ratio,
    get_map_pixels_inside_polygon,
    get_pixel_area,
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


@patch("app.modules.maps.helpers.read_json_file")
def test_get_all_maps(mock_read_json_file):
    mock_data = [
        {"id": 1, "name": "Deforestation Map A"},
        {"id": 2, "name": "Deforestation Map B"},
    ]
    mock_read_json_file.return_value = mock_data
    response = get_all_maps()
    assert response == mock_data

    mock_read_json_file.return_value = None
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


def test_get_pixel_area():
    map_data = {"pixel_size": 10}
    response = get_pixel_area(map_data)
    assert response == 100


def test_create_empty_tile():
    response = create_empty_tile()
    assert response == Image.new("RGBA", (256, 256), (0, 0, 0, 0))


def test_get_deforestation_percentage_valid():
    # Mock pixel data (example: 10 pixels, with 6 deforested)
    pixels = np.array([1, 0, 3, 1, 0, 2, 0, 0, 1, 3])
    pixel_area = 5  # Example area per pixel
    polygon_area = 100  # Example polygon area

    # Call the function
    result = get_deforestation_ratio(pixels, polygon_area, pixel_area)

    # Expected: (3 deforested pixels * 5 pixel area) / 100 polygon area = 0.15 (15%)
    assert result == 0.15


@patch("app.modules.deforestation_analysis.helpers.mask")
def test_get_map_pixels_inside_polygon(mock_mask):
    # Create a simple polygon (square)
    polygon = Polygon(
        [
            (-50.0, -10.0),
            (-50.0, -9.5),
            (-49.5, -9.5),
            (-49.5, -10.0),
            (-50.0, -10.0),
        ]
    )

    # Mock rasterio dataset
    mock_dataset = MagicMock()
    mock_dataset.crs = "EPSG:4326"

    mock_mask.return_value = (
        np.array([[[1, 2], [3, 4]]]),
        None,
    )  # Fake clipped raster data

    # Call function
    result = get_map_pixels_inside_polygon(polygon, mock_dataset)

    # Assertions
    assert isinstance(result, np.ndarray)  # Ensure it returns a NumPy array
    assert result.shape == (2, 2)  # Expected shape
    assert (result == np.array([[[1, 2], [3, 4]]])).all()  # Ensure correct pixel values


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
