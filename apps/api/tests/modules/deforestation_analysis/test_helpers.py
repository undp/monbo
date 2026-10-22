import asyncio
from unittest.mock import patch

import geopandas as gpd
import mercantile
import numpy as np
import pyproj
import pytest
import rasterio
from fastapi import HTTPException
from PIL import Image
from rasterio import features
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from shapely import box
from shapely.geometry import Polygon, shape
from shapely.ops import transform as transform_geometry
from shapely.ops import unary_union

from app.modules.deforestation_analysis.helpers import (
    create_empty_tile,
    get_loss_area_fraction,
    get_tile,
)
from app.modules.maps.helpers import get_all_maps, get_map_by_id


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
        # docs/deforestation_calculation.md: 1 ha (10/3 x 10/3 pixels of 30 m in
        # UTM) on 2 whole loss pixels and on a third of another (300 m²):
        # (1,800 + 300) / 10,000. Counting whole pixels gave 27%.
        pytest.param(
            [(0, 0), (0, 1), (0, 3)],
            (0, 0, 10 / 3, 10 / 3),
            0.21,
            id="the documentation's example",
        ),
    ],
)
def test_get_loss_area_fraction(layer, loss_pixels, pixel_box, expected):
    open_layer, polygon = layer
    with open_layer(loss_pixels) as src:
        result = get_loss_area_fraction(polygon(*pixel_box), src)
    assert result == pytest.approx(expected, abs=1e-6)
    assert 0.0 <= result <= 1.0


@pytest.mark.parametrize("crs", list(LAYERS), ids=["EPSG:4326", "UTM"])
def test_get_loss_area_fraction_matches_an_equal_area_reference(crs):
    """Random polygons on a random layer, against an independent computation: the
    union of the loss pixels intersected with the polygon, and the polygon, both
    measured in an equal-area projection (EPSG:6933)."""
    rng = np.random.default_rng(2026)
    west, north, size = LAYERS[crs]
    n = 40
    data = (rng.random((n, n)) < 0.3).astype(np.uint8)
    transform = from_origin(west, north, size, size)
    loss = unary_union(
        [
            shape(geometry)
            for geometry, value in features.shapes(
                data, mask=data == 1, transform=transform
            )
            if value == 1
        ]
    )
    to_wgs84 = pyproj.Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    with MemoryFile() as memfile:
        with memfile.open(
            driver="GTiff",
            width=n,
            height=n,
            count=1,
            dtype="uint8",
            crs=crs,
            transform=transform,
        ) as dst:
            dst.write(data, 1)
        with memfile.open() as src:
            for _ in range(25):
                # A star-shaped polygon of up to 6 pixels' radius in the layer
                col, row = rng.uniform(8, n - 8, 2)
                vertices = int(rng.integers(6, 11))
                angles = np.sort(rng.uniform(0, 2 * np.pi, vertices))
                radii = rng.uniform(0.5, 6, vertices)
                farm = Polygon(
                    zip(
                        west + (col + radii * np.cos(angles)) * size,
                        north - (row + radii * np.sin(angles)) * size,
                    )
                ).segmentize(size / 8)
                areas = gpd.GeoSeries([loss.intersection(farm), farm], crs=crs).to_crs(
                    "EPSG:6933"
                )
                expected = areas.iloc[0].area / areas.iloc[1].area

                result = get_loss_area_fraction(
                    transform_geometry(to_wgs84.transform, farm), src
                )

                assert result == pytest.approx(expected, abs=1e-6)


def test_get_loss_area_fraction_outside_the_raster(layer):
    open_layer, polygon = layer
    with open_layer([(0, 0)]) as src, pytest.raises(ValueError):
        get_loss_area_fraction(polygon(10, 10, 12, 12), src)


def test_get_tile(tmp_path):
    # Where each pixel is drawn is checked in tests/utils/test_loss_drawing.py.
    path = tmp_path / "all_loss.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=100,
        height=100,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_origin(-0.01, 0.01, 0.0002, 0.0002),
    ) as dst:
        dst.write(np.ones((100, 100), dtype=np.uint8), 1)
    inside = mercantile.tile(0, 0, 18)

    tile = asyncio.run(get_tile(str(path), inside.z, inside.x, inside.y))

    assert tile.size == (256, 256) and tile.mode == "RGBA"
    assert set(tile.getdata()) == {(255, 0, 0, 255)}  # loss is red, opaque
    outside = mercantile.tile(10, 10, 18)
    empty = asyncio.run(get_tile(str(path), outside.z, outside.x, outside.y))
    assert empty == create_empty_tile()


def test_get_tile_of_an_unreadable_raster_is_an_error(tmp_path):
    with pytest.raises(HTTPException):
        asyncio.run(get_tile(str(tmp_path / "missing.tif"), 18, 0, 0))
