import threading
from collections import OrderedDict
from typing import Any, Callable, TypeVar

from rasterio import open as rasterio_open
from rasterio.vrt import WarpedVRT

T = TypeVar("T")


class _CachedRaster:
    def __init__(self, path: str, target_crs: str):
        self.src: Any = rasterio_open(path)
        try:
            self.vrt: Any = WarpedVRT(self.src, crs=target_crs)
        except BaseException:
            # Not stored, so nobody would close the dataset: do it here.
            self.src.close()
            raise
        # GDAL handles are not thread-safe: one reader at a time per raster.
        self.lock = threading.Lock()
        self.closed = False

    def close(self) -> None:
        with self.lock:  # waits for a read in progress
            self.closed = True
            self.vrt.close()
            self.src.close()


class RasterDatasetCache:
    """
    Keeps rasters open, warped to the target CRS, between requests. Synchronous:
    call it from a worker thread.

    Keyed by path: a raster's filename names its version and is never replaced in
    place (see `app.modules.layers.store`), so an entry can't go stale. The least
    recently used rasters are closed beyond `max_entries`.
    """

    def __init__(self, max_entries: int = 16, target_crs: str = "EPSG:3857"):
        self.max_entries = max_entries
        self.target_crs = target_crs
        self._entries: OrderedDict[str, _CachedRaster] = OrderedDict()
        self._lock = threading.Lock()

    def read(self, path: str, fn: Callable[[Any], T]) -> T:
        """Calls `fn` with the raster's WarpedVRT, holding the raster's lock."""
        while True:
            entry = self._get(path)
            with entry.lock:
                if entry.closed:
                    continue  # evicted between _get and the lock: open it again
                return fn(entry.vrt)

    def clear(self) -> None:
        with self._lock:
            entries = list(self._entries.values())
            self._entries.clear()
        for entry in entries:
            entry.close()

    def __len__(self) -> int:
        return len(self._entries)

    def _get(self, path: str) -> _CachedRaster:
        evicted: list[_CachedRaster] = []
        with self._lock:
            entry = self._entries.get(path)
            if entry is not None:
                self._entries.move_to_end(path)
                return entry
            # Opened under the lock, so two threads don't open the same raster.
            entry = _CachedRaster(path, self.target_crs)
            self._entries[path] = entry
            while len(self._entries) > self.max_entries:
                evicted.append(self._entries.popitem(last=False)[1])
        for old in evicted:  # outside the cache's lock: waits for its readers
            old.close()
        return entry


raster_dataset_cache = RasterDatasetCache()
