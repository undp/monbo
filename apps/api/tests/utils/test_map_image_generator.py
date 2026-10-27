import asyncio

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds
from shapely.geometry import MultiPolygon, Point, Polygon

from app.utils.image_generation.constants import MapDefaults
from app.utils.image_generation.GeometryHelper import GeometryHelper
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper
from app.utils.image_generation.MapImageGenerator import MapImageGenerator

# A 100x100 EPSG:4326 raster around (0, 0), about 22 m per pixel, all loss (1).
LOSS_BOUNDS = (-0.01, -0.01, 0.01, 0.01)


@pytest.fixture
def all_loss_raster(tmp_path):
    path = tmp_path / "loss.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=100,
        height=100,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_bounds(*LOSS_BOUNDS, 100, 100),
    ) as dst:
        dst.write(np.ones((100, 100), dtype=np.uint8), 1)
    return str(path)


def _generate(geometry, tif_path, point_radius_meters=None):
    return asyncio.run(
        MapImageGenerator.generate(
            geometry,
            tif_path,
            point_radius_meters,
            include_satelital_background=False,
        )
    )


def _outline_pixels(image) -> int:
    """Pixels with the outline's yellow on top: over the red, the outline's green
    stays above 200, while the red over the outline brings it under 100, and the
    fills (16% and 47% opaque) keep it under 150."""
    rgb = np.asarray(image.convert("RGB")).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return int(((r > 200) & (g > 180) & (b < 120)).sum())


def test_the_polygon_outline_is_drawn_over_the_deforestation(all_loss_raster):
    square = Polygon(
        [(-0.002, -0.002), (-0.002, 0.002), (0.002, 0.002), (0.002, -0.002)]
    )
    image = _generate(square, all_loss_raster)
    assert _outline_pixels(image) > 100


def test_the_point_outline_is_drawn_over_the_deforestation(all_loss_raster):
    image = _generate(Point(0, 0), all_loss_raster, point_radius_meters=50)
    assert _outline_pixels(image) > 50


# North–south extent 10 times the east–west one, and the other way around.
TALL = Polygon([(-0.0005, -0.005), (-0.0005, 0.005), (0.0005, 0.005), (0.0005, -0.005)])
WIDE = Polygon([(-0.005, -0.0005), (-0.005, 0.0005), (0.005, 0.0005), (0.005, -0.0005)])


# Two parts about 5 km apart: one image holds both
TWO_PARTS = MultiPolygon(
    [
        Polygon([(-0.001, -0.001), (-0.001, 0.001), (0.001, 0.001), (0.001, -0.001)]),
        Polygon([(0.044, -0.001), (0.044, 0.001), (0.046, 0.001), (0.046, -0.001)]),
    ]
)


@pytest.mark.parametrize(
    "farm",
    [
        pytest.param(TALL, id="tall"),
        pytest.param(WIDE, id="wide"),
        pytest.param(TWO_PARTS, id="two parts far apart"),
    ],
)
def test_the_whole_farm_fits_the_image_with_its_padding(farm):
    min_lon, min_lat, max_lon, max_lat = farm.bounds
    zoom = GoogleMapsAPIHelper.calculate_zoom_from_bounds(
        min_lat, max_lat, min_lon, max_lon, MapDefaults.OUTPUT_SIZE
    )
    img_min_lat, img_max_lat, img_min_lon, img_max_lon = (
        GoogleMapsAPIHelper.get_image_bounds(
            (min_lat + max_lat) / 2,
            (min_lon + max_lon) / 2,
            zoom,
            MapDefaults.OUTPUT_SIZE,
        )
    )
    # Near the equator, degrees are close enough to Web Mercator's linear scale.
    lat_padding = (max_lat - min_lat) * MapDefaults.PADDING_RATIO * 0.99
    lon_padding = (max_lon - min_lon) * MapDefaults.PADDING_RATIO * 0.99
    assert img_min_lat <= min_lat - lat_padding
    assert img_max_lat >= max_lat + lat_padding
    assert img_min_lon <= min_lon - lon_padding
    assert img_max_lon >= max_lon + lon_padding


def test_the_image_has_the_report_box_aspect_ratio(all_loss_raster):
    """640x420: the ratio of the map box on the report's farm page (styles.ts)."""
    image = _generate(TALL, all_loss_raster)
    assert image.size == (640, 420)


def test_the_bounds_hold_every_part():
    min_lat, max_lat, min_lon, max_lon = GeometryHelper.calculate_geometry_bounds(
        TWO_PARTS
    )
    assert (min_lon, min_lat, max_lon, max_lat) == TWO_PARTS.bounds


def test_a_farm_with_two_parts_gets_one_image(all_loss_raster):
    image = _generate(TWO_PARTS, all_loss_raster)
    assert image.size == (640, 420)
    assert _outline_pixels(image) > 0


SQUARE = [(-0.004, -0.004), (-0.004, 0.004), (0.004, 0.004), (0.004, -0.004)]
HOLE = [(-0.002, -0.002), (0.002, -0.002), (0.002, 0.002), (-0.002, 0.002)]


def test_a_hole_is_outlined_and_not_filled(all_loss_raster):
    solid = _generate(Polygon(SQUARE), all_loss_raster)
    ring = _generate(Polygon(SQUARE, [HOLE]), all_loss_raster)
    # The hole's outline adds yellow pixels
    assert _outline_pixels(ring) > _outline_pixels(solid) * 1.3
    # The image is centered on the farm, so its center is in the hole: there the
    # loss shows as it does outside the farm (above it, on the raster), without the
    # fill's tint
    center = (320, 210)
    above = (320, 2)
    ring_rgb = ring.convert("RGB")
    solid_rgb = solid.convert("RGB")
    assert ring_rgb.getpixel(center) == ring_rgb.getpixel(above)
    assert solid_rgb.getpixel(center) != solid_rgb.getpixel(above)


ISLAND = [(-0.001, -0.001), (-0.001, 0.001), (0.001, 0.001), (0.001, -0.001)]


def test_a_part_inside_another_parts_hole_is_filled(all_loss_raster):
    """A valid MultiPolygon: a ring-shaped part and an island part inside its
    hole. The hole must not erase the island's fill."""
    farm = MultiPolygon([Polygon(SQUARE, [HOLE]), Polygon(ISLAND)])
    assert farm.is_valid
    solid = _generate(Polygon(SQUARE), all_loss_raster).convert("RGB")
    ring = _generate(Polygon(SQUARE, [HOLE]), all_loss_raster).convert("RGB")
    with_island = _generate(farm, all_loss_raster).convert("RGB")
    # The image is centered on the farm, so its center is on the island: there
    # the fill tints the loss as it does on a solid farm, unlike in the empty hole
    center = (320, 210)
    assert with_island.getpixel(center) == solid.getpixel(center)
    assert with_island.getpixel(center) != ring.getpixel(center)
