"""Where the API draws loss pixels: map tiles and report images are compared with
an exact render, the source pixel under each output pixel's centre."""

import asyncio

import mercantile
import numpy as np
import pytest
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from shapely.geometry import box

from app.helpers.GeometryCalculator import GeometryCalculator
from app.modules.deforestation_analysis.helpers import get_tile
from app.utils.image_generation.constants import MapDefaults
from app.utils.image_generation.errors import NoRasterDataOverlapError
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper
from app.utils.image_generation.loss_mask import render_loss_mask
from app.utils.image_generation.RasterDatasetCache import raster_dataset_cache
from app.utils.image_generation.RasterManipulationHelper import (
    RasterManipulationHelper,
)

WEB_MERCATOR = "EPSG:3857"

# 300 x 300 layers with a random loss pattern, so any shift changes many pixels:
# geographic ones in Ecuador and in Costa Rica (where Web Mercator stretches a
# pixel by 1.5%), and a UTM one. Their origins are off any round number, so no
# output pixel's centre falls on a source pixel's edge.
LAYERS = {
    "EPSG:4326, Ecuador": ("EPSG:4326", -76.951237, -0.213571, 0.00027),
    "EPSG:4326, Costa Rica": ("EPSG:4326", -84.102913, 10.203377, 0.00027),
    "UTM 17S, Ecuador": ("EPSG:32717", 700_013.7, 9_976_011.3, 30.0),
}
SIZE = 300


def _write_layer(path, crs, west, north, pixel, size=SIZE, overviews=()):
    data = (np.random.default_rng(7).random((size, size)) < 0.4).astype(np.uint8)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=size,
        height=size,
        count=1,
        dtype="uint8",
        crs=crs,
        transform=from_origin(west, north, pixel, pixel),
        tiled=True,
        blockxsize=256,
        blockysize=256,
    ) as dst:
        dst.write(data, 1)
    if overviews:
        with rasterio.open(path, "r+") as dst:
            dst.build_overviews(list(overviews), Resampling.nearest)
    return str(path)


@pytest.fixture(autouse=True)
def _close_cached_rasters():
    yield
    raster_dataset_cache.clear()


@pytest.fixture(params=list(LAYERS))
def layer(request, tmp_path):
    return _write_layer(tmp_path / "loss.tif", *LAYERS[request.param])


# How close to a source pixel's edge an output pixel's centre may fall and still
# be drawn from the pixel on the other side: GDAL approximates the transform
# (0.0004 of a pixel measured in UTM, 1 cm at 30 m).
EDGE_TOLERANCE = 0.001


def exact_render(path, bounds, width, height, overview_level=None):
    """The value of the source pixel under each output pixel's centre: the output
    grid in Web Mercator, mapped to the raster through pyproj and its transform.
    Also the output pixels whose centre is within EDGE_TOLERANCE of a source
    pixel's edge."""
    left, bottom, right, top = bounds
    xs = left + (np.arange(width) + 0.5) * (right - left) / width
    ys = top - (np.arange(height) + 0.5) * (top - bottom) / height
    x, y = np.meshgrid(xs, ys)
    options = {} if overview_level is None else {"overview_level": overview_level}
    with rasterio.open(path, **options) as src:
        to_src = Transformer.from_crs(WEB_MERCATOR, src.crs, always_xy=True)
        exact_cols, exact_rows = ~src.transform * to_src.transform(x, y)
        cols, rows = np.floor(exact_cols).astype(int), np.floor(exact_rows).astype(int)
        inside = (cols >= 0) & (cols < src.width) & (rows >= 0) & (rows < src.height)
        data = src.read(1)
    loss = np.zeros((height, width), dtype=bool)
    loss[inside] = data[rows[inside], cols[inside]] == 1
    on_edge = (np.abs(exact_cols - np.round(exact_cols)) < EDGE_TOLERANCE) | (
        np.abs(exact_rows - np.round(exact_rows)) < EDGE_TOLERANCE
    )
    return loss, on_edge


def assert_drawn_as(drawn, expected):
    """Every output pixel shows the source pixel under its centre, but those
    within EDGE_TOLERANCE of an edge, which may show either side."""
    loss, on_edge = expected
    assert loss.any() and not loss.all()
    assert not ((drawn != loss) & ~on_edge).any()


def _centre_lon_lat(path):
    with rasterio.open(path) as src:
        x = (src.bounds.left + src.bounds.right) / 2
        y = (src.bounds.bottom + src.bounds.top) / 2
        return Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True).transform(
            x, y
        )


def _tile_loss(path, tile):
    image = asyncio.run(get_tile(path, tile.z, tile.x, tile.y))
    return np.asarray(image)[..., 3] > 0


@pytest.mark.parametrize("zoom", [13, 15, 17, 19])
def test_a_tile_draws_each_pixel_from_the_source_pixel_under_it(layer, zoom):
    tile = mercantile.tile(*_centre_lon_lat(layer), zoom)

    drawn = _tile_loss(layer, tile)

    assert_drawn_as(drawn, exact_render(layer, mercantile.xy_bounds(tile), 256, 256))


def test_a_tile_outside_the_raster_is_empty(layer):
    tile = mercantile.tile(-60.0, 10.0, 15)
    assert not _tile_loss(layer, tile).any()


def _image_bounds(geometry, zoom):
    """The report image's bounds in Web Mercator, as the image generator gets them."""
    lat, lon = GeometryCalculator.calculate_geometry_center(geometry)
    min_lat, max_lat, min_lon, max_lon = GoogleMapsAPIHelper.get_image_bounds(
        lat, lon, zoom, MapDefaults.OUTPUT_SIZE
    )
    to_mercator = Transformer.from_crs("EPSG:4326", WEB_MERCATOR, always_xy=True)
    left, bottom = to_mercator.transform(min_lon, min_lat)
    right, top = to_mercator.transform(max_lon, max_lat)
    return left, bottom, right, top


@pytest.mark.parametrize("zoom", [16, 18])
def test_a_report_image_draws_each_pixel_from_the_source_pixel_under_it(layer, zoom):
    lon, lat = _centre_lon_lat(layer)
    farm = box(lon - 0.001, lat - 0.001, lon + 0.001, lat + 0.001)

    image = asyncio.run(
        RasterManipulationHelper.generate_deforestation_image_from_bounds(
            farm, layer, zoom
        )
    )

    width, height = MapDefaults.OUTPUT_SIZE
    assert_drawn_as(
        np.asarray(image)[..., 3] > 0,
        exact_render(layer, _image_bounds(farm, zoom), width, height),
    )


def test_a_report_image_outside_the_raster_has_no_overlap(layer):
    farm = box(-60.001, 9.999, -59.999, 10.001)
    with pytest.raises(NoRasterDataOverlapError):
        asyncio.run(
            RasterManipulationHelper.generate_deforestation_image_from_bounds(
                farm, layer, 16
            )
        )


@pytest.fixture
def layer_with_overviews(tmp_path):
    # 1024 pixels of 0.00027° (~30 m), with overviews of 2, 4, 8 and 16 times that.
    return _write_layer(
        tmp_path / "cog.tif",
        *LAYERS["EPSG:4326, Ecuador"],
        size=1024,
        overviews=(2, 4, 8, 16),
    )


@pytest.mark.parametrize(
    ("zoom", "overview_level"),
    [
        # A z10 tile pixel is ~153 m: the 4x overview (~120 m) is the coarsest
        # finer than it.
        pytest.param(10, 1, id="low zoom: an overview"),
        # A z15 tile pixel is ~4.8 m: no overview is that fine.
        pytest.param(15, None, id="high zoom: the full resolution"),
    ],
)
def test_a_tile_reads_the_coarsest_overview_finer_than_its_pixel(
    layer_with_overviews, zoom, overview_level
):
    tile = mercantile.tile(*_centre_lon_lat(layer_with_overviews), zoom)

    drawn = _tile_loss(layer_with_overviews, tile)

    bounds = mercantile.xy_bounds(tile)
    assert_drawn_as(
        drawn, exact_render(layer_with_overviews, bounds, 256, 256, overview_level)
    )


def test_the_validation_farm_is_drawn_as_its_ratio_counts_it(tmp_path):
    """F-VALIDACION on a crop of the real GFW raster: its share drawn red on the
    map is its ratio, 25% (see test_analize_the_validation_farm_on_real_gfw_pixels).
    The old drawing, off by about half a pixel, showed it 17.7% red."""
    from tests.modules.deforestation_analysis.test_router import (
        GFW_CROP,
        VALIDATION_FARM,
    )

    path = tmp_path / "gfw.tif"
    path.write_bytes(GFW_CROP.read_bytes())
    lons, lats = zip(*VALIDATION_FARM)
    to_mercator = Transformer.from_crs("EPSG:4326", WEB_MERCATOR, always_xy=True)
    left, bottom = to_mercator.transform(min(lons), min(lats))
    right, top = to_mercator.transform(max(lons), max(lats))

    # The farm's bounding box is the farm: ~0.3 m pixels over its 120 x 90 m.
    drawn = raster_dataset_cache.read(
        str(path),
        lambda raster: render_loss_mask(raster, (left, bottom, right, top), 400, 300),
    )

    assert drawn.mean() == pytest.approx(0.25, abs=0.005)
