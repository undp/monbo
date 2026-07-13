"""Numeric-correctness gate for numpy 2 (and, again, rasterio 1.5 in PR 4).

Runs the deterministic deforestation fixture under the committed uv.lock (which
resolves numpy 2.4.6) and compares its outputs against the version-controlled
reference captured from the pre-upgrade Python 3.11 / rasterio 1.4 / numpy 1
environment (see ``tests/numeric_baseline/generate_baseline.py``).

Tolerances (enforced automatically, per the python-dependency-toolchain spec):
- scalar deforestation ratios: math.isclose(rel_tol=1e-6, abs_tol=1e-8);
- generated rasters: exactly equal CRS, affine transform, dimensions, band
  count, dtype, nodata value and valid/nodata mask, and every valid numeric
  pixel within numpy.allclose(rtol=1e-6, atol=1e-8, equal_nan=True);
- rendered images: decoded, exactly equal dimensions and channel count, no more
  than 0.1% differing channel values, and every differing 8-bit channel within
  an absolute delta of 1.

Linux x86_64 in GitHub Actions is the blocking reference platform.
"""

import json
import math

import numpy as np
import pytest
from PIL import Image

from tests.numeric_baseline import _common

SCALAR_REL_TOL = 1e-6
SCALAR_ABS_TOL = 1e-8
PIXEL_RTOL = 1e-6
PIXEL_ATOL = 1e-8
IMAGE_MAX_DIFF_FRACTION = 0.001  # 0.1% of channel values
IMAGE_MAX_CHANNEL_DELTA = 1


@pytest.fixture(scope="module")
def baseline() -> dict:
    with open(_common.BASELINE_JSON) as fh:
        return json.load(fh)


@pytest.fixture(scope="module")
def outputs() -> dict:
    # Runs the pipeline under the current (numpy 2) environment.
    return _common.compute_outputs(_common.RASTER_PATH)


def test_fixture_and_baseline_present():
    assert _common.RASTER_PATH.exists(), "version-controlled fixture raster missing"
    assert _common.BASELINE_JSON.exists()
    assert _common.BASELINE_RASTER.exists()
    assert _common.BASELINE_TILE.exists()


def test_baseline_captured_from_numpy1_reference(baseline):
    # Guard against a baseline accidentally regenerated under numpy 2, which the
    # spec says is not evidence of compatibility.
    assert baseline["tooling"]["numpy"].startswith("1."), (
        "baseline must be captured under numpy 1; regenerating it under numpy 2 "
        "is not evidence of compatibility"
    )
    assert baseline["tooling"]["rasterio"].startswith("1.4.")


def test_scalar_ratios_within_tolerance(baseline, outputs):
    for key, expected in baseline["scalars"].items():
        actual = outputs[key]
        assert math.isclose(
            actual, expected, rel_tol=SCALAR_REL_TOL, abs_tol=SCALAR_ABS_TOL
        ), f"scalar '{key}' drifted: actual={actual!r} expected={expected!r}"


def test_raster_metadata_and_pixels_within_tolerance(baseline, outputs):
    meta = baseline["raster_metadata"]
    raster = outputs["raster"]

    # Metadata must match exactly.
    assert raster["crs"] == meta["crs"]
    assert raster["count"] == meta["count"]
    assert raster["dtype"] == meta["dtype"]
    assert raster["nodata"] == meta["nodata"]
    assert raster["transform"] == meta["transform"]
    assert list(raster["pixels"].shape) == meta["shape"]

    with np.load(_common.BASELINE_RASTER) as data:
        expected_pixels = data["pixels"]
        expected_mask = data["valid_mask"]

    actual_pixels = raster["pixels"]
    actual_mask = raster["valid_mask"]

    # Valid/nodata mask must be exactly equal.
    assert actual_mask.shape == expected_mask.shape
    assert np.array_equal(actual_mask, expected_mask)

    # Every valid numeric pixel within tolerance.
    assert actual_pixels.shape == expected_pixels.shape
    assert np.allclose(
        actual_pixels[expected_mask].astype(np.float64),
        expected_pixels[expected_mask].astype(np.float64),
        rtol=PIXEL_RTOL,
        atol=PIXEL_ATOL,
        equal_nan=True,
    )


def test_rendered_image_within_tolerance(outputs):
    expected_img = np.asarray(Image.open(_common.BASELINE_TILE)).astype(np.int16)
    actual_img = np.asarray(outputs["tile_image"]).astype(np.int16)

    # Exactly equal dimensions and channel count.
    assert actual_img.shape == expected_img.shape

    diff = np.abs(actual_img - expected_img)
    differing = diff > 0
    fraction_differing = differing.sum() / diff.size
    assert fraction_differing <= IMAGE_MAX_DIFF_FRACTION, (
        f"{fraction_differing:.4%} of channel values differ "
        f"(limit {IMAGE_MAX_DIFF_FRACTION:.2%})"
    )
    if differing.any():
        assert diff[differing].max() <= IMAGE_MAX_CHANNEL_DELTA
