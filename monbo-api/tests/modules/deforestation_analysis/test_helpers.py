from unittest.mock import patch, MagicMock
from fastapi import HTTPException
import mercantile
import numpy as np
import pytest
from PIL import Image
from shapely import Polygon
from app.modules.deforestation_analysis.helpers import (
    create_empty_tile,
    get_all_maps,
    get_deforestation_percentage,
    get_map_by_id,
    get_map_pixels_inside_polygon,
    get_pixel_area,
    get_tile,
)
from rasterio.errors import WindowError


@patch("app.modules.deforestation_analysis.helpers.read_json_file")
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


@patch("app.modules.deforestation_analysis.helpers.get_all_maps")
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
    map_data = {"asset": {"pixel_size": 10}}
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
    result = get_deforestation_percentage(pixels, polygon_area, pixel_area)

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


@patch("app.modules.deforestation_analysis.helpers.rasterio.open")
@patch("app.modules.deforestation_analysis.helpers.WarpedVRT")
@patch("app.modules.deforestation_analysis.helpers.mercantile.xy_bounds")
def test_get_tile(mock_xy_bounds, mock_warped_vrt, mock_raster_open):
    # Mocking input parameters
    tif_path = "app/map_assets/example.tif"
    red_tile_values = {1, 2, 3}  # Values considered "red"
    z, x, y = 10, 500, 300  # Tile coordinates

    # Mock raster dataset and VRT
    mock_src = MagicMock()
    mock_src.count = 1  # Single-band raster
    mock_raster_open.return_value.__enter__.return_value = mock_src

    mock_vrt = MagicMock()
    mock_vrt.bounds = mercantile.Bbox(-180, -90, 180, 90)  # Global coverage
    mock_vrt.count = 1
    mock_vrt.window.return_value = mercantile.Bbox(0, 0, 10, 10)  # Mock window
    mock_vrt.read.return_value = np.random.randint(0, 5, (1, 256, 256), dtype=np.uint8)

    mock_warped_vrt.return_value.__enter__.return_value = mock_vrt

    mock_xy_bounds.return_value = mercantile.Bbox(
        left=-45, bottom=-45, right=45, top=45
    )

    # Call function
    result = get_tile(tif_path, red_tile_values, z, x, y)

    # Assertions
    assert isinstance(result, Image.Image)  # Ensure return type is PIL Image
    assert result.size == (256, 256)  # Ensure correct size
    assert result.mode == "RGBA"  # Ensure correct mode
    mock_raster_open.assert_called_once_with(tif_path)  # Ensure raster opened
    mock_xy_bounds.assert_called_once_with(x, y, z)  # Ensure tile bounds checked

    mock_vrt.read.return_value = np.random.randint(0, 5, (2, 256, 256), dtype=np.uint8)
    result = get_tile(tif_path, red_tile_values, z, x, y)

    # Assertions
    assert isinstance(result, Image.Image)  # Ensure return type is PIL Image
    assert result.size == (256, 256)  # Ensure correct size
    assert result.mode == "RGBA"  # Ensure correct mode

    # Simulate a case where the tile is outside bounds
    mock_vrt.bounds = mercantile.Bbox(60, 60, 70, 70)  # Change bounds to exclude tile
    result_empty = get_tile(tif_path, red_tile_values, z, x, y)
    assert result_empty == Image.new(
        "RGBA", (256, 256), (0, 0, 0, 0)
    )  # Ensure empty tile returned

    # Simulate a window calculation failure
    mock_vrt.bounds = mercantile.Bbox(-180, -90, 180, 90)  # Global coverage
    mock_vrt.window.side_effect = WindowError("Invalid window")
    mock_window_error = get_tile(tif_path, red_tile_values, z, x, y)
    assert mock_window_error == Image.new("RGBA", (256, 256), (0, 0, 0, 0))

    # Simulate Exception
    mock_vrt.window.side_effect = WindowsError("Invalid window")
    with pytest.raises(HTTPException):
        get_tile(tif_path, red_tile_values, z, x, y)
