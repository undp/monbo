import shutil
import threading
from pathlib import Path

import pytest

from app.utils.image_generation import RasterDatasetCache as cache_module
from app.utils.image_generation.RasterDatasetCache import RasterDatasetCache

FIXTURE = Path(__file__).parents[1] / "numeric_baseline" / "fixture.tif"


def copies(tmp_path: Path, n: int) -> list[str]:
    paths = []
    for i in range(n):
        path = tmp_path / f"layer-{i}-v1.tif"
        shutil.copyfile(FIXTURE, path)
        paths.append(str(path))
    return paths


def test_a_raster_is_opened_once(tmp_path):
    (path,) = copies(tmp_path, 1)
    cache = RasterDatasetCache(max_entries=4)
    first = cache.read(path, lambda vrt: vrt)
    second = cache.read(path, lambda vrt: vrt)
    assert first is second
    assert first.crs.to_string() == "EPSG:3857"
    assert cache.read(path, lambda vrt: vrt.read(1).shape) == (vrt_shape := first.shape)
    assert vrt_shape[0] > 0
    cache.clear()
    assert first.closed


def test_evicted_rasters_are_closed_and_reopened(tmp_path):
    a, b, c = copies(tmp_path, 3)
    cache = RasterDatasetCache(max_entries=2)
    vrt_a = cache.read(a, lambda vrt: vrt)
    cache.read(b, lambda vrt: vrt)
    cache.read(c, lambda vrt: vrt)  # evicts a, the least recently used
    assert len(cache) == 2
    assert vrt_a.closed
    reopened = cache.read(a, lambda vrt: vrt)
    assert reopened is not vrt_a and not reopened.closed
    cache.clear()


def test_the_dataset_is_closed_if_the_vrt_fails(tmp_path, monkeypatch):
    """A failed WarpedVRT isn't stored, so the open dataset must not leak."""
    (path,) = copies(tmp_path, 1)
    opened = []
    real_open = cache_module.rasterio_open

    def spy_open(p):
        src = real_open(p)
        opened.append(src)
        return src

    def failing_vrt(*args, **kwargs):
        raise RuntimeError("corrupt raster")

    monkeypatch.setattr(cache_module, "rasterio_open", spy_open)
    monkeypatch.setattr(cache_module, "WarpedVRT", failing_vrt)
    cache = RasterDatasetCache(max_entries=2)
    with pytest.raises(RuntimeError, match="corrupt raster"):
        cache.read(path, lambda vrt: vrt)
    assert len(cache) == 0
    assert len(opened) == 1 and opened[0].closed

    # The next read, once the raster is readable, opens it normally.
    monkeypatch.undo()
    assert not cache.read(path, lambda vrt: vrt).closed
    cache.clear()


def test_reads_of_one_raster_are_serialized(tmp_path):
    """GDAL handles are not thread-safe: one reader at a time per raster."""
    (path,) = copies(tmp_path, 1)
    cache = RasterDatasetCache(max_entries=2)
    inside = 0
    overlapped = False
    lock = threading.Lock()

    def read(vrt):
        nonlocal inside, overlapped
        with lock:
            inside += 1
            overlapped |= inside > 1
        vrt.read(1)
        with lock:
            inside -= 1

    threads = [threading.Thread(target=cache.read, args=(path, read)) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert not overlapped
    cache.clear()
