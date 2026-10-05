"""Single owner of every file under the layers root (``MAPS_ROOT``).

The root has one of two layouts:

- per country: ``countries.json`` (the country registry) and one folder per country
  (``CO/``, ``EC/``...), each holding its own ``index.json``, metadata and rasters.
  Every layer belongs to one country, and ids are numbered within each country, so a
  layer is identified by its country and its id.
- flat (legacy, like the Git-tracked ``app/maps``): one ``index.json`` at the root
  whose layers list their countries in ``available_countries_codes``. It is served
  read-only: the layers admin needs the per-country layout.

`LayerStore` handles one flat directory (the legacy root, or one country folder);
`LayersRoot` handles the whole root. Ingestion jobs live at the root in both.

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
REGISTRY_FILENAME = "countries.json"
# Languages every layer's attributes and considerations are kept in.
SUPPORTED_LANGUAGES = ("en", "es")
REPLACE_ATTEMPTS = 10
REPLACE_BACKOFF_SECONDS = 0.1

_LANGUAGE_PATTERN = re.compile(r"^[a-z]{2}$")
_JOB_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
_COUNTRY_CODE_PATTERN = re.compile(r"^[A-Z]{2}$")
_PASSKEY_HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class LayoutError(Exception):
    """The layers root holds both layouts at once."""


def is_country_folder_name(code: str) -> bool:
    """An uppercase two-letter code: safe as a folder name under the root."""
    return bool(_COUNTRY_CODE_PATTERN.match(code))


class ReadBackMismatch(OSError):
    """The target, right after the rename, doesn't contain what was written."""


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
    def __init__(
        self, root: str | os.PathLike[str], lock: "threading.RLock | None" = None
    ):
        self.root = Path(root)
        # Shared by every store under one layers root: one lock per process.
        self._lock = lock or threading.RLock()
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

    def has_raster(self, filename: str | None) -> bool:
        """Whether a layer's raster file exists (new layers have none yet)."""
        if not filename or not _is_safe_filename(filename):
            return False
        return self.raster_path(filename).is_file()

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

    def locked(self) -> threading.RLock:
        """Hold this around a read-modify-write of the index (e.g. assigning an id),
        so concurrent admin requests can't interleave."""
        return self._lock

    def write_attributes(self, filename: str, language: str, attributes: dict) -> None:
        path = self._require_metadata_path(self.attributes_path(filename, language))
        data = json.dumps(attributes, indent=2, ensure_ascii=False) + "\n"
        self._atomic_write(path, data.encode("utf-8"))

    def write_considerations(
        self, filename: str, language: str, text: str | None
    ) -> None:
        """Write the markdown, or remove the file when there is no text."""
        path = self._require_metadata_path(self.considerations_path(filename, language))
        if text:
            self._atomic_write(path, (text.strip() + "\n").encode("utf-8"))
            return
        with self._lock:
            # Safe on SMB even if a reader has it open: the file goes away on close.
            path.unlink(missing_ok=True)

    @staticmethod
    def _require_metadata_path(path: Path | None) -> Path:
        if path is None:
            raise ValueError("Invalid metadata filename or language")
        return path

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
        """Write `data` to a temporary file next to `target`, then rename it over.

        If the rename is refused, or the target doesn't read back, the temporary file
        is kept with the intended contents: on SMB a refused rename can delete the
        target once another handle closes it, and the kept file is then the only copy
        (restore it by renaming it to the target). Other failures leave the target
        untouched and remove the temporary file.
        """
        with self._lock:
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
            try:
                with open(tmp, "wb") as file:
                    file.write(data)
                    file.flush()
                    os.fsync(file.fileno())
            except BaseException:
                tmp.unlink(missing_ok=True)  # never written: nothing worth keeping
                raise
            try:
                self._replace(tmp, target, data)
            except (PermissionError, ReadBackMismatch):
                self._keep_pending(tmp, target, data)
                raise
            except BaseException:
                tmp.unlink(missing_ok=True)
                raise
            # Only left after the in-place fallback, once the target matches it.
            try:
                tmp.unlink(missing_ok=True)
            except OSError as e:
                logger.warning("Cannot remove temporary file '%s': %s", tmp, e)

    @staticmethod
    def _keep_pending(tmp: Path, target: Path, data: bytes) -> None:
        try:
            if not tmp.exists():  # renamed over a target that didn't read back right
                tmp.write_bytes(data)
            logger.error(
                "Could not replace '%s'; its intended contents are kept in '%s'",
                target,
                tmp,
            )
        except OSError as e:
            logger.error("Could not replace '%s' nor keep '%s': %s", target, tmp, e)

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
                raise ReadBackMismatch(
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

    # --- Ingestion jobs ------------------------------------------------------

    def _job_path(self, job_id: str) -> Path | None:
        if not _JOB_ID_PATTERN.match(job_id):
            return None
        return self.jobs_dir / f"{job_id}.json"

    def write_job(self, job: dict) -> None:
        path = self._job_path(job["jobId"])
        if path is None:
            raise ValueError(f"Invalid job id '{job['jobId']}'")
        data = json.dumps(job, indent=2, ensure_ascii=False) + "\n"
        self._atomic_write(path, data.encode("utf-8"))

    def read_job(self, job_id: str) -> dict | None:
        path = self._job_path(job_id)
        if path is None:
            return None
        with self._lock:
            content = self._read_json(path)
        return content if isinstance(content, dict) else None

    def list_jobs(self) -> list[dict]:
        with self._lock:
            paths = (
                sorted(self.jobs_dir.glob("*.json")) if self.jobs_dir.is_dir() else []
            )
            jobs = [self._read_json(path) for path in paths]
        return [job for job in jobs if isinstance(job, dict)]

    # --- Health --------------------------------------------------------------

    def is_writable(self) -> bool:
        return self.root.is_dir() and os.access(self.root, os.W_OK | os.X_OK)


def is_layer(entry: dict, country: str | None, layer_id: int) -> bool:
    """Whether a layer from `LayersRoot.layers()` is `layer_id` of `country`. Ids
    are numbered within each country; in the flat layout they are unique on their
    own, and a given country must be one the layer lists."""
    if entry["id"] != layer_id:
        return False
    if entry.get("country") is not None and entry["country"] != country:
        return False
    return country is None or country in entry.get("available_countries_codes", [])


def _valid_registry(content: Any) -> list[dict] | None:
    if not isinstance(content, dict) or not isinstance(content.get("countries"), list):
        return None
    countries = content["countries"]
    codes = set()
    for country in countries:
        if (
            not isinstance(country, dict)
            or not isinstance(country.get("code"), str)
            or not is_country_folder_name(country["code"])
            or country["code"] in codes
            or not isinstance(country.get("enabled"), bool)
            or not isinstance(country.get("passkey_hash"), str)
            or not _PASSKEY_HASH_PATTERN.match(country["passkey_hash"])
        ):
            return None
        codes.add(country["code"])
    return countries


class LayersRoot:
    """The whole layers root, in either layout (see the module docstring)."""

    def __init__(self, root: str | os.PathLike[str]):
        self.root = Path(root)
        self._lock = threading.RLock()
        # The legacy index, and in both layouts the jobs and the share staging area.
        self.flat = LayerStore(self.root, self._lock)
        self._country_stores: dict[str, LayerStore] = {}
        self._registry_cache: tuple[tuple[int, int], list[dict]] | None = None

    # --- Layout --------------------------------------------------------------

    @property
    def registry_path(self) -> Path:
        return self.root / REGISTRY_FILENAME

    def is_per_country(self) -> bool:
        """Whether the root uses the per-country layout. A root without either file
        counts as flat (its index is just missing, as before)."""
        has_registry = self.registry_path.is_file()
        if has_registry and self.flat.index_path.is_file():
            raise LayoutError(
                f"{self.root} has both {INDEX_FILENAME} and {REGISTRY_FILENAME}: "
                "keep only the flat index or only the per-country layout"
            )
        return has_registry

    def has_layout(self) -> bool:
        """Whether the root holds layers in either layout: the country registry or
        the flat index. False too when the root folder doesn't exist."""
        return self.registry_path.is_file() or self.flat.index_path.is_file()

    # --- Country registry ----------------------------------------------------

    def read_registry(self) -> list[dict] | None:
        """The registered countries (`code`, `passkey_hash`, `enabled`).

        Cached while the file is unchanged. If the file can't be parsed, the last
        valid registry read by this process is kept (and an error logged), so a bad
        edit doesn't lock every admin out of a running API.
        """
        with self._lock:
            try:
                stat = self.registry_path.stat()
            except OSError as e:
                logger.warning("Cannot read the country registry: %s", e)
                return self._cached_registry()
            key = (stat.st_mtime_ns, stat.st_size)
            if self._registry_cache is not None and self._registry_cache[0] == key:
                return self._cached_registry()
            countries = _valid_registry(LayerStore._read_json(self.registry_path))
            if countries is None:
                logger.error(
                    "Invalid country registry at '%s'; keeping the last valid one",
                    self.registry_path,
                )
                return self._cached_registry()
            self._registry_cache = (key, countries)
            return self._cached_registry()

    def _cached_registry(self) -> list[dict] | None:
        if self._registry_cache is None:
            return None
        return copy.deepcopy(self._registry_cache[1])

    def write_registry(self, countries: list[dict]) -> None:
        if _valid_registry({"countries": countries}) is None:
            raise ValueError("Invalid country registry")
        data = json.dumps({"countries": countries}, indent=2) + "\n"
        with self._lock:
            self.flat._atomic_write(self.registry_path, data.encode("utf-8"))
            stat = self.registry_path.stat()
            self._registry_cache = (
                (stat.st_mtime_ns, stat.st_size),
                copy.deepcopy(countries),
            )

    def registered_country(self, code: str) -> dict | None:
        return next((c for c in self.read_registry() or [] if c["code"] == code), None)

    def country_store(self, code: str) -> LayerStore:
        """The folder of one country (per-country layout)."""
        if not is_country_folder_name(code):
            raise ValueError(f"Invalid country code '{code}'")
        with self._lock:
            if code not in self._country_stores:
                self._country_stores[code] = LayerStore(self.root / code, self._lock)
            return self._country_stores[code]

    # --- Layers across countries ---------------------------------------------

    def layers(self) -> list[dict] | None:
        """Every layer, enabled or not, each with its `country` (None in the flat
        layout, whose layers list theirs in `available_countries_codes`). In the
        per-country layout `available_countries_codes` is set to `[country]`, so
        both layouts read the same. None if the index or registry can't be read."""
        with self._lock:
            if not self.is_per_country():
                index = self.flat.read_index()
                if index is None:
                    return None
                return [{**entry, "country": None} for entry in index]
            registry = self.read_registry()
            if registry is None:
                return None
            layers = []
            for country in registry:
                code = country["code"]
                index = self.country_store(code).read_index()
                if index is None:
                    return None
                for entry in index:
                    layers.append(
                        {**entry, "country": code, "available_countries_codes": [code]}
                    )
            return layers

    def country_layers(self, code: str) -> list[dict] | None:
        """One country's layers, enabled or not, tagged like `layers()`. For the
        per-country layout only. It reads just that country's index, so another
        country's unreadable index doesn't affect it. [] for a country that isn't
        registered; None if its index can't be read."""
        with self._lock:
            if self.registered_country(code) is None:
                return []
            index = self.country_store(code).read_index()
            if index is None:
                return None
            return [
                {**entry, "country": code, "available_countries_codes": [code]}
                for entry in index
            ]

    def find_layer(self, country: str | None, layer_id: int) -> dict | None:
        return next(
            (
                entry
                for entry in self.layers() or []
                if is_layer(entry, country, layer_id)
            ),
            None,
        )

    def store_for(self, layer: dict) -> LayerStore:
        """The store holding a layer returned by `layers()`."""
        country = layer.get("country")
        return self.flat if country is None else self.country_store(country)

    def enabled_countries(self) -> set[str] | None:
        """Codes enabled in the registry; None in the flat layout (no registry)."""
        if not self.is_per_country():
            return None
        return {c["code"] for c in self.read_registry() or [] if c["enabled"]}

    def public_countries(self) -> list[str] | None:
        """Countries a visitor can pick: in the per-country layout, those enabled in
        the registry with at least one enabled layer; in the flat layout, the
        countries of the enabled layers. None if any index cannot be read."""
        layers = self.layers()
        if layers is None:
            return None
        enabled_layers = [entry for entry in layers if entry["enabled"]]
        codes = {
            code
            for entry in enabled_layers
            for code in entry.get("available_countries_codes", [])
        }
        allowed = self.enabled_countries()
        if allowed is not None:
            codes &= allowed
        return sorted(codes)

    # --- Shared --------------------------------------------------------------

    def locked(self) -> threading.RLock:
        return self._lock

    def is_writable(self) -> bool:
        return self.flat.is_writable()


# Built once at import time: the constructor doesn't touch the disk, and a single
# instance means a single lock guarding every index for the whole process.
_default_root = LayersRoot(env.MAPS_ROOT)
_root = _default_root


def get_layers_root() -> LayersRoot:
    """The process-wide layers root for `MAPS_ROOT`."""
    return _root


def set_layers_root(root: LayersRoot | None) -> None:
    """Replace the process-wide root (used by tests). `None` restores the default."""
    global _root
    _root = root if root is not None else _default_root
