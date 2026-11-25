"""The pixel-size gate: the declared layer pixel size against the raster's cell area."""

from types import SimpleNamespace

import pytest
from affine import Affine
from rasterio.coords import BoundingBox
from rasterio.crs import CRS

from app.modules.layers.processing import (
    IngestionError,
    check_pixel_size,
    raster_pixel_size_range_m,
)


def raster(crs: str, west: float, north: float, res: float, width: int, height: int):
    """Just what the gate reads from a dataset: CRS, transform and bounds."""
    transform = Affine(res, 0, west, 0, -res, north)
    return SimpleNamespace(
        crs=CRS.from_user_input(crs),
        transform=transform,
        bounds=BoundingBox(west, north - res * height, west + res * width, north),
    )


def error_code(declared, measured) -> str | None:
    try:
        check_pixel_size(declared, measured)
    except IngestionError as error:
        return error.code
    return None


def test_projected_metre_raster():
    # UTM 17S (Ecuador), 30 m pixels.
    src = raster("EPSG:32717", 500_000, 9_900_000, 30, 100, 100)

    assert raster_pixel_size_range_m(src) == (30, 30)
    assert error_code(30, raster_pixel_size_range_m(src)) is None
    assert error_code(10, raster_pixel_size_range_m(src)) == "resolution_mismatch"


def test_projected_raster_in_feet():
    # NY State Plane (US survey feet): 98.4252 ft is 30 m.
    src = raster("EPSG:2263", 1_000_000, 200_000, 98.4252, 100, 100)

    smallest, largest = raster_pixel_size_range_m(src)
    assert smallest == largest == pytest.approx(30, abs=0.01)
    assert error_code(30, (smallest, largest)) is None


def test_tolerance_applies_to_the_area_not_the_side():
    # 10.45 m pixels declared as 10 m: 4.5% on the side, but ~8.4% on the area
    # (and on every ratio). The previous linear 5% check let it through.
    src = raster("EPSG:32717", 500_000, 9_900_000, 10.45, 100, 100)

    assert error_code(10, raster_pixel_size_range_m(src)) == "resolution_mismatch"
    assert error_code(10.4, raster_pixel_size_range_m(src)) is None


def test_geographic_raster_is_checked_at_its_widest_and_narrowest_latitude():
    # Like the gfw layer: 0.00025° from -5.4° to 14° (Ecuador, Colombia, Costa Rica).
    src = raster("EPSG:4326", -80, 14, 0.00025, 100, int(19.4 / 0.00025))

    smallest, largest = raster_pixel_size_range_m(src)
    # Largest at the equator (crossed by the raster), smallest at 14° N.
    assert largest == pytest.approx(27.73, abs=0.01)
    assert smallest == pytest.approx(27.32, abs=0.01)
    assert error_code(27.5, (smallest, largest)) is None


def test_geographic_raster_spanning_too_many_latitudes_is_rejected():
    # Brazil-like extent, +5° to -34°: the cell area at -34° is ~17% smaller than at
    # the equator, so no single pixel size is within 5% of the area everywhere.
    src = raster("EPSG:4326", -74, 5, 0.00025, 100, int(39 / 0.00025))

    smallest, largest = raster_pixel_size_range_m(src)
    assert smallest < largest * 0.92
    for declared in (smallest, (smallest + largest) / 2, largest, 27, 28):
        assert error_code(declared, (smallest, largest)) == "resolution_varies"


def test_unknown_pixel_size_is_rejected():
    assert error_code(30, None) == "resolution_unavailable"
