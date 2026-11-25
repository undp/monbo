import os
import shutil
import threading
from pathlib import Path

import pytest
import rasterio
from rasterio.enums import Resampling

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
    first = cache.read(path, lambda raster: raster)
    second = cache.read(path, lambda raster: raster)
    assert first is second
    assert cache.read(path, lambda raster: raster.src.read(1).shape) == (64, 64)
    # The fixture's bounds (EPSG:4326, around -70/-5) in Web Mercator
    left, bottom, right, top = first.bounds_3857
    assert -7_795_000 < left < right < -7_789_000 and bottom < top < 0
    cache.clear()
    assert first.src.closed


def test_evicted_rasters_are_closed_and_reopened(tmp_path):
    a, b, c = copies(tmp_path, 3)
    cache = RasterDatasetCache(max_entries=2)
    raster_a = cache.read(a, lambda raster: raster)
    cache.read(b, lambda raster: raster)
    cache.read(c, lambda raster: raster)  # evicts a, the least recently used
    assert len(cache) == 2
    assert raster_a.src.closed
    reopened = cache.read(a, lambda raster: raster)
    assert reopened is not raster_a and not reopened.src.closed
    cache.clear()


def test_a_raster_rewritten_at_the_same_path_is_reopened(tmp_path):
    """A seed rewrites `<stem>-v1.tif` in place: the old handle must not survive."""
    (path,) = copies(tmp_path, 1)
    cache = RasterDatasetCache(max_entries=2)
    before = cache.read(path, lambda raster: raster)
    # Same bytes, so the size is equal: only the mtime tells the files apart.
    stat = os.stat(path)
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))
    after = cache.read(path, lambda raster: raster)
    assert after is not before
    assert before.src.closed and not after.src.closed
    assert len(cache) == 1
    assert cache.read(path, lambda raster: raster) is after
    cache.clear()


def test_the_dataset_is_closed_if_opening_it_fails(tmp_path, monkeypatch):
    """A raster that fails after it's open isn't stored, so it must not leak."""
    (path,) = copies(tmp_path, 1)
    opened = []
    real_open = cache_module.rasterio_open

    def spy_open(p):
        src = real_open(p)
        opened.append(src)
        return src

    def failing_bounds(*args, **kwargs):
        raise RuntimeError("corrupt raster")

    monkeypatch.setattr(cache_module, "rasterio_open", spy_open)
    monkeypatch.setattr(cache_module, "transform_bounds", failing_bounds)
    cache = RasterDatasetCache(max_entries=2)
    with pytest.raises(RuntimeError, match="corrupt raster"):
        cache.read(path, lambda raster: raster)
    assert len(cache) == 0
    assert len(opened) == 1 and opened[0].closed

    # The next read, once the raster is readable, opens it normally.
    monkeypatch.undo()
    assert not cache.read(path, lambda raster: raster.src).closed
    cache.clear()


def test_reads_of_one_raster_are_serialized(tmp_path):
    """GDAL handles are not thread-safe: one reader at a time per raster."""
    (path,) = copies(tmp_path, 1)
    cache = RasterDatasetCache(max_entries=2)
    inside = 0
    overlapped = False
    lock = threading.Lock()

    def read(raster):
        nonlocal inside, overlapped
        with lock:
            inside += 1
            overlapped |= inside > 1
        raster.src.read(1)
        with lock:
            inside -= 1

    threads = [threading.Thread(target=cache.read, args=(path, read)) for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert not overlapped
    cache.clear()


def test_overviews_are_opened_once_and_closed_with_the_raster(tmp_path):
    (path,) = copies(tmp_path, 1)
    with rasterio.open(path, "r+") as dst:
        dst.build_overviews([2, 4], Resampling.nearest)
    cache = RasterDatasetCache(max_entries=2)

    full = cache.read(path, lambda raster: raster.dataset(None))
    half = cache.read(path, lambda raster: raster.dataset(0))
    quarter = cache.read(path, lambda raster: raster.dataset(1))

    assert full is cache.read(path, lambda raster: raster.src)
    assert half is cache.read(path, lambda raster: raster.dataset(0))
    assert (full.width, half.width, quarter.width) == (64, 32, 16)
    cache.clear()
    assert full.closed and half.closed and quarter.closed
