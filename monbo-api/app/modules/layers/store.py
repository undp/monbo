"""Single owner of every file under the layers root (``MAPS_ROOT``).

The root may be an Azure Files (SMB) mount, and two properties of that mount shape
this module (measured in the add-layers-admin spike):

- ``os.replace`` over a file that another handle has open fails with ``EACCES`` and
  leaves the target deleted once that handle closes. Every read and write of the
  index and the metadata therefore holds one process-wide lock, so no handle is
  open while a file is replaced, and a refused replace is retried.
- ``chmod`` is not permitted, so files are only ever copied with
  ``shutil.copyfile`` (never ``shutil.copy`` or ``shutil.copystat``).

Rasters are never replaced in place (each version gets a new filename), so raster
reads don't take the lock.
"""

import copy
import json
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from app.config import env
from app.config.logger import get_logger

logger = get_logger("modules.layers.store")

INDEX_FILENAME = "index.json"
REPLACE_ATTEMPTS = 10
REPLACE_BACKOFF_SECONDS = 0.1

_LANGUAGE_PATTERN = re.compile(r"^[a-z]{2}$")


def _is_safe_filename(name: str) -> bool:
    """A bare file name: no directories, no parent references."""
    return bool(name) and name not in (".", "..") and Path(name).name == name


def _with_defaults(entry: dict) -> dict:
    """Index entries written before `enabled`/`version` existed stay valid."""
    return {
        **entry,
        "enabled": entry.get("enabled", True),
        "version": entry.get("version", 1),
    }


class LayerStore:
    def __init__(self, root: str | os.PathLike[str]):
        self.root = Path(root)
        self._lock = threading.RLock()
        self._index_cache: tuple[tuple[int, int], list[dict]] | None = None

    # --- Paths ---------------------------------------------------------------

    @property
    def index_path(self) -> Path:
        return self.root / INDEX_FILENAME

    @property
    def rasters_dir(self) -> Path:
        return self.root / "layers" / "rasters"

    @property
    def staging_dir(self) -> Path:
        return self.root / ".staging"

    @property
    def jobs_dir(self) -> Path:
        return self.root / ".jobs"

    def attributes_path(self, filename: str, language: str) -> Path | None:
        return self._metadata_path("attributes", filename, language)

    def considerations_path(self, filename: str, language: str) -> Path | None:
        return self._metadata_path("considerations", filename, language)

    def raster_path(self, filename: str) -> Path:
        if not _is_safe_filename(filename):
            raise FileNotFoundError(f"Invalid raster filename '{filename}'")
        return self.rasters_dir / filename

    def _metadata_path(self, kind: str, filename: str, language: str) -> Path | None:
        # `language` comes straight from the query string: never let it (or a
        # filename) walk out of the metadata directory.
        if not _LANGUAGE_PATTERN.match(language) or not _is_safe_filename(filename):
            return None
        return self.root / "metadata" / kind / language / filename

    # --- Reads ---------------------------------------------------------------

    def read_index(self) -> list[dict] | None:
        """All index entries (enabled or not), with defaults applied.

        The parsed index is cached and reused while the file's mtime and size are
        unchanged, so most requests don't open `index.json` at all.
        """
        with self._lock:
            try:
                stat = self.index_path.stat()
            except OSError as e:
                logger.warning(
                    "Cannot read layers index at '%s': %s", self.index_path, e
                )
                return None
            key = (stat.st_mtime_ns, stat.st_size)
            if self._index_cache is None or self._index_cache[0] != key:
                content = self._read_json(self.index_path)
                if not isinstance(content, list) or not all(
                    isinstance(entry, dict) for entry in content
                ):
                    logger.warning("Invalid layers index at '%s'", self.index_path)
                    return None
                self._index_cache = (key, [_with_defaults(entry) for entry in content])
            return copy.deepcopy(self._index_cache[1])

    def read_attributes(self, filename: str, language: str) -> dict | None:
        path = self.attributes_path(filename, language)
        if path is None:
            return None
        with self._lock:
            content = self._read_json(path)
        if not isinstance(content, dict):
            logger.warning("Cannot read attributes file at '%s'", path)
            return None
        return content

    def read_considerations(self, filename: str, language: str) -> str | None:
        path = self.considerations_path(filename, language)
        if path is None:
            return None
        with self._lock:
            try:
                return path.read_text(encoding="utf-8").strip()
            except OSError as e:
                logger.warning("Cannot read considerations file at '%s': %s", path, e)
                return None

    @staticmethod
    def _read_json(path: Path) -> Any:
        try:
            with open(path, "r", encoding="utf-8") as file:
                return json.load(file)
        except (OSError, json.JSONDecodeError):
            return None

    # --- Writes --------------------------------------------------------------

    def write_index(self, entries: list[dict]) -> None:
        data = (json.dumps(entries, indent=2, ensure_ascii=False) + "\n").encode(
            "utf-8"
        )
        with self._lock:
            self._atomic_write(self.index_path, data)
            stat = self.index_path.stat()
            self._index_cache = (
                (stat.st_mtime_ns, stat.st_size),
                [_with_defaults(entry) for entry in copy.deepcopy(entries)],
            )

    def _atomic_write(self, target: Path, data: bytes) -> None:
        """Write `data` to a temporary file next to `target`, then rename it over."""
        with self._lock:
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
            try:
                with open(tmp, "wb") as file:
                    file.write(data)
                    file.flush()
                    os.fsync(file.fileno())
                self._replace(tmp, target, data)
            finally:
                # The temporary file only survives if no rename succeeded.
                try:
                    tmp.unlink(missing_ok=True)
                except OSError as e:
                    logger.warning("Cannot remove temporary file '%s': %s", tmp, e)

    def _replace(self, tmp: Path, target: Path, data: bytes) -> None:
        last_error: PermissionError | None = None
        for attempt in range(1, REPLACE_ATTEMPTS + 1):
            try:
                os.replace(tmp, target)
            except PermissionError as e:
                last_error = e
                logger.warning(
                    "Replacing '%s' was refused (attempt %d/%d): %s",
                    target,
                    attempt,
                    REPLACE_ATTEMPTS,
                    e,
                )
                time.sleep(REPLACE_BACKOFF_SECONDS)
                continue
            if target.read_bytes() != data:
                raise OSError(
                    f"Read-back of '{target}' does not match what was written"
                )
            return

        # Every rename was refused. On SMB a refused rename can delete the target, so
        # never return with it missing: write it in place as a last resort.
        if not target.exists():
            logger.error(
                "'%s' disappeared after refused renames; writing it in place", target
            )
            with open(target, "wb") as file:
                file.write(data)
                file.flush()
                os.fsync(file.fileno())
            return
        assert last_error is not None
        raise last_error

    # --- Health --------------------------------------------------------------

    def is_writable(self) -> bool:
        return self.root.is_dir() and os.access(self.root, os.W_OK | os.X_OK)


# Built once at import time: the constructor doesn't touch the disk, and a single
# instance means a single lock guarding the index for the whole process.
_default_store = LayerStore(env.MAPS_ROOT)
_store = _default_store


def get_layer_store() -> LayerStore:
    """The process-wide store for `MAPS_ROOT`."""
    return _store


def set_layer_store(store: LayerStore | None) -> None:
    """Replace the process-wide store (used by tests). `None` restores the default."""
    global _store
    _store = store if store is not None else _default_store
