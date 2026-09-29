import json
import os
from pathlib import Path

import pytest

# Tests must not pick up a developer's .env, e.g. the local admin setup from
# docs/onboarding.md. load_dotenv() doesn't override variables that are already set,
# so blank these before the app reads its configuration.
for _name in (
    "MAPS_ROOT",
    "ADMIN_PASSKEY_HASH",
    "ADMIN_SESSION_SECRET",
    "ADMIN_ALLOWED_ORIGIN",
):
    os.environ[_name] = ""

from app.modules.admin.auth import hash_passkey  # noqa: E402
from app.modules.layers.store import LayersRoot, set_layers_root  # noqa: E402
from tests.modules.admin.support import COUNTRY_PASSKEYS  # noqa: E402


class LayersDir:
    """Writes the files of one flat layers directory: a legacy root or a country."""

    def __init__(self, root: Path):
        self.root = root

    def write_index(self, entries: list[dict]) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "index.json").write_text(json.dumps(entries), encoding="utf-8")

    def write_attributes(self, language: str, filename: str, data: dict) -> None:
        path = self.root / "metadata" / "attributes" / language / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def write_considerations(self, language: str, filename: str, text: str) -> None:
        path = self.root / "metadata" / "considerations" / language / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def write_raster(self, filename: str, content: bytes = b"raster") -> Path:
        path = self.root / "layers" / "rasters" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path


class MapsRoot(LayersDir):
    """A throwaway MAPS_ROOT on disk in the flat (legacy) layout, installed as the
    process-wide layers root."""

    def __init__(self, root: Path):
        super().__init__(root)
        self.layers_root = LayersRoot(root)
        self.store = self.layers_root.flat


class CountryMapsRoot:
    """A throwaway MAPS_ROOT in the per-country layout, installed as the
    process-wide layers root. `register` uses the passkeys in COUNTRY_PASSKEYS."""

    def __init__(self, root: Path):
        self.root = root
        self.layers_root = LayersRoot(root)

    def country(self, code: str) -> LayersDir:
        return LayersDir(self.root / code)

    def store(self, code: str):
        return self.layers_root.country_store(code)

    def write_registry(self, countries: list[dict]) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "countries.json").write_text(
            json.dumps({"countries": countries}), encoding="utf-8"
        )

    def register(self, *codes: str, enabled: bool = True) -> None:
        self.write_registry(
            [
                {
                    "code": code,
                    "passkey_hash": hash_passkey(COUNTRY_PASSKEYS[code]),
                    "enabled": enabled,
                }
                for code in codes
            ]
        )
        for code in codes:
            if not (self.root / code / "index.json").exists():
                self.country(code).write_index([])


@pytest.fixture
def maps_root(tmp_path):
    root = MapsRoot(tmp_path / "maps")
    root.root.mkdir()
    set_layers_root(root.layers_root)
    yield root
    set_layers_root(None)


@pytest.fixture
def country_root(tmp_path):
    root = CountryMapsRoot(tmp_path / "maps")
    root.root.mkdir()
    set_layers_root(root.layers_root)
    yield root
    set_layers_root(None)
