"""Capture the version-controlled numeric baseline for the numpy 2 gate.

This MUST be run under the approved pre-upgrade reference environment
(Python 3.11 / rasterio 1.4.3 / numpy 1), NOT under the candidate numpy 2
lock — regenerating expected outputs with the numpy 2 environment is not
evidence of compatibility. From ``monbo-api`` run:

    uv run --with "numpy==1.26.4" --with "rasterio==1.4.3" \
        python -m tests.numeric_baseline.generate_baseline

It writes (and overwrites) the committed fixture raster and baseline artifacts:
``fixture.tif``, ``baseline.json``, ``baseline_raster.npz`` and
``baseline_tile.png``. Regenerating these is a deliberate, reviewed act:
changing the fixture, baseline values or tolerances requires an explicit
rationale in review.
"""

import json
import platform

import geopandas as gpd
import numpy as np
import PIL
import pyproj
import rasterio
import shapely

from tests.numeric_baseline import _common


def _tooling() -> dict:
    return {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "rasterio": rasterio.__version__,
        "shapely": shapely.__version__,
        "geopandas": gpd.__version__,
        "pyproj": pyproj.__version__,
        "pillow": PIL.__version__,
        "system": platform.system(),
        "machine": platform.machine(),
        "platform": platform.platform(),
    }


def main() -> None:
    # 1. (Re)create the deterministic synthetic raster fixture.
    _common.create_fixture_raster(_common.RASTER_PATH)

    # 2. Run the analysis pipeline and capture reference outputs.
    outputs = _common.compute_outputs(_common.RASTER_PATH)
    raster = outputs["raster"]

    # 3. Persist raster array + valid mask (binary, exact).
    np.savez_compressed(
        _common.BASELINE_RASTER,
        pixels=raster["pixels"],
        valid_mask=raster["valid_mask"],
    )

    # 4. Persist decoded rendered tile as PNG.
    outputs["tile_image"].save(_common.BASELINE_TILE, format="PNG")

    # 5. Persist scalars + raster metadata + tooling/platform provenance.
    baseline = {
        "reference_platform": "Linux x86_64 (GitHub Actions)",
        "tooling": _tooling(),
        "map_data": _common.MAP_DATA,
        "analysis_polygon": _common.ANALYSIS_POLYGON,
        "tile_zxy": list(_common.TILE_ZXY),
        "scalars": {
            "scalar_ratio": outputs["scalar_ratio"],
            "scalar_ratio_pure": outputs["scalar_ratio_pure"],
            "polygon_area": outputs["polygon_area"],
        },
        "raster_metadata": {
            "crs": raster["crs"],
            "count": raster["count"],
            "dtype": raster["dtype"],
            "nodata": raster["nodata"],
            "transform": raster["transform"],
            "shape": list(raster["pixels"].shape),
        },
    }
    with open(_common.BASELINE_JSON, "w") as fh:
        json.dump(baseline, fh, indent=2, sort_keys=True)

    print("Baseline captured with tooling:")
    print(json.dumps(baseline["tooling"], indent=2))
    print("Scalars:", json.dumps(baseline["scalars"], indent=2))


if __name__ == "__main__":
    main()
