import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.admin.auth import country_for_passkey
from app.modules.layers.migrate_countries import (
    MigrationError,
    id_mapping,
    migrate,
    plan,
)
from app.modules.layers.store import LayersRoot, set_layers_root
from tests.regression.parity import compare_migrated
from tests.regression.pipeline import FIXTURE_MAPS_ROOT

# The ids and countries of today's six layers (app/maps/index.json).
TODAY = [
    {"id": 0, "available_countries_codes": ["EC", "CO", "CR"]},  # GFW
    {"id": 1, "available_countries_codes": ["EC", "CO", "CR"]},  # TMF
    {"id": 2, "available_countries_codes": ["EC"]},
    {"id": 3, "available_countries_codes": ["CO"]},
    {"id": 4, "available_countries_codes": ["EC"]},
    {"id": 5, "available_countries_codes": ["CR"]},
]


@pytest.fixture
def migrated(tmp_path):
    """The regression fixture layers, migrated and installed as the layers root."""
    target = tmp_path / "v2"
    passkeys = migrate(
        FIXTURE_MAPS_ROOT,
        target,
        log=lambda _: None,
        mapping_out=tmp_path / "ids.json",
    )
    root = LayersRoot(target)
    set_layers_root(root)
    yield root, passkeys
    set_layers_root(None)


def ids(root, code):
    index = json.loads((root.root / code / "index.json").read_text())
    return [entry["id"] for entry in index]


def test_each_country_numbers_its_layers_from_0():
    copies = [
        (country, layer_id, entry["id"]) for country, layer_id, entry in plan(TODAY)
    ]

    assert copies == [
        ("EC", 0, 0),
        ("CO", 0, 0),
        ("CR", 0, 0),
        ("EC", 1, 1),
        ("CO", 1, 1),
        ("CR", 1, 1),
        ("EC", 2, 2),
        ("CO", 2, 3),
        ("EC", 3, 4),
        ("CR", 2, 5),
    ]
    assert id_mapping(plan(TODAY)) == {
        "EC": {"0": 0, "1": 1, "2": 2, "4": 3},
        "CO": {"0": 0, "1": 1, "3": 2},
        "CR": {"0": 0, "1": 1, "5": 2},
    }


def test_layers_go_to_their_countries(migrated):
    root, passkeys = migrated

    assert root.is_per_country()
    assert ids(root, "EC") == [0, 1, 2, 3]
    assert ids(root, "CO") == [0, 1, 2]
    assert ids(root, "CR") == [0, 1, 2]
    assert [c["code"] for c in root.read_registry()] == ["EC", "CO", "CR"]
    for code, passkey in passkeys.items():
        assert country_for_passkey(passkey)["code"] == code
    for code in ("EC", "CO", "CR"):
        for entry in json.loads((root.root / code / "index.json").read_text()):
            assert "available_countries_codes" not in entry


def test_rasters_are_copied_whole(migrated):
    root, _ = migrated
    source = FIXTURE_MAPS_ROOT / "layers" / "rasters" / "gfw.tif"

    for code in ("EC", "CO", "CR"):
        copy = root.root / code / "layers" / "rasters" / "gfw.tif"
        assert copy.read_bytes() == source.read_bytes()
    assert not (root.root / "CO" / "layers" / "rasters" / "ecuador.tif").exists()


def test_metadata_is_copied_to_every_country_of_the_layer(tmp_path):
    source = tmp_path / "flat"
    shutil.copytree(FIXTURE_MAPS_ROOT, source)
    for language in ("en", "es"):
        attributes = source / "metadata" / "attributes" / language / "gfw.json"
        attributes.parent.mkdir(parents=True, exist_ok=True)
        attributes.write_text(json.dumps({"name": f"GFW {language}", "alias": "GFW"}))
    (source / "metadata" / "considerations" / "es").mkdir(parents=True)
    (source / "metadata" / "considerations" / "es" / "gfw.md").write_text("Notas")

    migrate(source, tmp_path / "v2", log=lambda _: None)

    for code in ("EC", "CO", "CR"):
        metadata = tmp_path / "v2" / code / "metadata"
        assert json.loads(
            (metadata / "attributes" / "es" / "gfw.json").read_text()
        ) == {
            "name": "GFW es",
            "alias": "GFW",
        }
        assert (metadata / "considerations" / "es" / "gfw.md").read_text() == "Notas"
    assert not (
        tmp_path / "v2" / "CO" / "metadata" / "attributes" / "es" / "ecuador.json"
    ).exists()


def test_a_non_empty_target_is_refused(tmp_path):
    target = tmp_path / "v2"
    target.mkdir()
    (target / "something").write_text("x")

    with pytest.raises(MigrationError, match="not empty"):
        migrate(FIXTURE_MAPS_ROOT, target, log=lambda _: None)
    assert [p.name for p in target.iterdir()] == ["something"]


def test_a_per_country_source_is_refused(migrated, tmp_path):
    root, _ = migrated

    with pytest.raises(MigrationError, match="not a flat layers root"):
        migrate(root.root, tmp_path / "again", log=lambda _: None)


class RootClient:
    """In-process client that serves one layers root (the pipeline only POSTs)."""

    def __init__(self, root):
        self.root = root

    def post(self, *args, **kwargs):
        set_layers_root(self.root)
        return TestClient(app).post(*args, **kwargs)


def test_analysis_parity_after_the_migration(migrated, tmp_path):
    """Every copy of a layer gives the results the original gave on the flat root."""
    root, _ = migrated
    mapping = json.loads((tmp_path / "ids.json").read_text())
    assert mapping["CO"] == {"0": 0, "1": 1, "3": 2}

    diffs = compare_migrated(
        RootClient(LayersRoot(FIXTURE_MAPS_ROOT)), RootClient(root), mapping
    )

    assert diffs == []


def test_parity_notices_a_wrong_mapping(migrated, tmp_path):
    root, _ = migrated
    mapping = json.loads((tmp_path / "ids.json").read_text())
    # Claim CO's IDEAM (2) is the copy of GFW (0).
    mapping["CO"] = {"0": 2}

    diffs = compare_migrated(
        RootClient(LayersRoot(FIXTURE_MAPS_ROOT)), RootClient(root), mapping
    )

    assert any(diff.startswith("CO.2 (was 0)") for diff in diffs)
