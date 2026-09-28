"""Regression suite: the 10 farms in `regression_farms.xlsx` must keep their results.

The farms cover high, partial and zero deforestation, points with and without a
declared area, a 10 m layer against 30 m layers, a polygon smaller than a pixel, a
polygon across the Ecuador-Colombia border, one outside every layer, an overlap and
a self-intersecting polygon (see the "Casos" sheet of the Excel).

If a change is *meant* to alter these results, regenerate the expected values with
`uv run python -m tests.regression.generate` and review the diff.
"""

import json

import openpyxl
import pytest

from app.modules.layers.store import LayerStore, get_layer_store, set_layer_store
from tests.regression.generate import is_lfs_pointer
from tests.regression.pipeline import (
    EXCEL_PATH,
    EXPECTED_PATH,
    FIXTURE_MAPS_ROOT,
    differences,
    read_farm_rows,
    run_pipeline,
)

TEMPLATE_PATH = (
    EXCEL_PATH.parents[3] / "monbo-front/public/files/m1-upload-file-template-es.xlsx"
)
REGENERATE_HINT = (
    "If this change is meant to alter results, run "
    "`uv run python -m tests.regression.generate` and review the diff."
)


def expected_results():
    return json.loads(EXPECTED_PATH.read_text(encoding="utf-8"))["results"]


def assert_same_results(actual):
    diffs = differences(actual, expected_results())
    assert not diffs, "\n".join(
        ["Regression results changed:", *diffs[:40], REGENERATE_HINT]
    )


def test_excel_is_still_a_valid_upload_file():
    """The regression Excel keeps the template's headers, so it can be uploaded."""
    template = openpyxl.load_workbook(TEMPLATE_PATH).worksheets[0]
    excel = openpyxl.load_workbook(EXCEL_PATH).worksheets[0]
    for row in (1, 2):
        assert [c.value for c in excel[row]] == [c.value for c in template[row]]

    rows = read_farm_rows()
    assert [row["id"] for row in rows] == [f"F{i:02d}" for i in range(1, 11)]


def test_regression_results_on_fixture_layers():
    """Runs everywhere (CI included): sparse copies of the real layers."""
    set_layer_store(LayerStore(FIXTURE_MAPS_ROOT))
    try:
        results = run_pipeline(read_farm_rows())
    finally:
        set_layer_store(None)
    assert_same_results(results)


def test_regression_results_on_real_layers():
    """Also catches changes in the real rasters or index. Needs `git lfs pull`."""
    store = get_layer_store()
    index = store.read_index() or []
    rasters = [store.raster_path(entry["raster_filename"]) for entry in index]
    if not rasters or any(not p.exists() or is_lfs_pointer(p) for p in rasters):
        pytest.skip("real rasters not available (Git LFS pointers)")

    assert_same_results(run_pipeline(read_farm_rows()))
