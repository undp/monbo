import json
from pathlib import Path

import pytest

from app.modules.layers.store import LayerStore, set_layer_store


class MapsRoot:
    """A throwaway MAPS_ROOT on disk, installed as the process-wide layer store."""

    def __init__(self, root: Path):
        self.root = root
        self.store = LayerStore(root)

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


@pytest.fixture
def maps_root(tmp_path):
    root = MapsRoot(tmp_path / "maps")
    root.root.mkdir()
    set_layer_store(root.store)
    yield root
    set_layer_store(None)
