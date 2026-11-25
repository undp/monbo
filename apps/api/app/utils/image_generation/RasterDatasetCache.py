import os
import threading
from collections import OrderedDict
from typing import Any, Callable, TypeVar

from rasterio import open as rasterio_open
from rasterio.warp import transform_bounds

from app.utils.image_generation.loss_mask import WEB_MERCATOR

T = TypeVar("T")


class CachedRaster:
    """An open raster, its bounds in Web Mercator and the overviews opened so far.
    Use it only inside `RasterDatasetCache.read`, which holds its lock."""

    def __init__(self, path: str, signature: tuple[int, int]):
        self.path = path
        self.signature = signature
        self.src: Any = rasterio_open(path)
        try:
            self.bounds_3857 = transform_bounds(
                self.src.crs, WEB_MERCATOR, *self.src.bounds
            )
        except BaseException:
            # Not stored, so nobody would close the dataset: do it here.
            self.src.close()
            raise
        self._overviews: dict[int, Any] = {}
        # GDAL handles are not thread-safe: one reader at a time per raster.
        self.lock = threading.Lock()
        self.closed = False

    def dataset(self, overview_level: int | None) -> Any:
        """The raster, or one of its overviews (opened on first use)."""
        if overview_level is None:
            return self.src
        if overview_level not in self._overviews:
            self._overviews[overview_level] = rasterio_open(
                self.path, overview_level=overview_level
            )
        return self._overviews[overview_level]

    def close(self) -> None:
        with self.lock:  # waits for a read in progress
            self.closed = True
            for overview in self._overviews.values():
                overview.close()
            self.src.close()


class RasterDatasetCache:
    """
    Keeps rasters open between requests, for the map's tiles and the report's
    images. Synchronous: call it from a worker thread.

    Keyed by path, and checked against the file's mtime and size on every read (as
    `LayerStore.read_index` does): a raster's filename names its version and the
    admin never replaces it in place (see `app.modules.layers.store`), but a seed
    of the share rewrites the same `<stem>-v1.tif` paths, and a cached handle would
    keep reading the old file while `/analize` reads the new one. A file that
    changed is closed and reopened. The least recently used rasters are closed
    beyond `max_entries`.
    """

    def __init__(self, max_entries: int = 16):
        self.max_entries = max_entries
        self._entries: OrderedDict[str, CachedRaster] = OrderedDict()
        self._lock = threading.Lock()

    def read(self, path: str, fn: Callable[[CachedRaster], T]) -> T:
        """Calls `fn` with the cached raster, holding the raster's lock."""
        while True:
            entry = self._get(path)
            with entry.lock:
                if entry.closed:
                    continue  # evicted between _get and the lock: open it again
                return fn(entry)

    def clear(self) -> None:
        with self._lock:
            entries = list(self._entries.values())
            self._entries.clear()
        for entry in entries:
            entry.close()

    def __len__(self) -> int:
        return len(self._entries)

    def _get(self, path: str) -> CachedRaster:
        evicted: list[CachedRaster] = []
        stat = os.stat(path)
        signature = (stat.st_mtime_ns, stat.st_size)
        with self._lock:
            entry = self._entries.get(path)
            if entry is not None and entry.signature == signature:
                self._entries.move_to_end(path)
                return entry
            if entry is not None:  # the file at this path changed: reopen it
                evicted.append(self._entries.pop(path))
            # Opened under the lock, so two threads don't open the same raster.
            entry = CachedRaster(path, signature)
            self._entries[path] = entry
            while len(self._entries) > self.max_entries:
                evicted.append(self._entries.popitem(last=False)[1])
        for old in evicted:  # outside the cache's lock: waits for its readers
            old.close()
        return entry


raster_dataset_cache = RasterDatasetCache()
