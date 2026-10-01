import errno
import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.config import env
from app.main import app
from app.modules.layers import store as store_module
from app.modules.layers.store import LayerStore, get_layer_store, set_layer_store
from app.modules.maps.helpers import get_map_by_id
from app.utils.maps import get_map_raster_path, read_attributes, read_considerations

client = TestClient(app)

GFW = {
    "id": 0,
    "raster_filename": "gfw-v1.tif",
    "attributes_filename": "gfw.json",
    "considerations_filename": "gfw.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": [],
    "available_countries_codes": ["EC"],
}
DISABLED = {
    **GFW,
    "id": 7,
    "raster_filename": "old-v3.tif",
    "enabled": False,
    "version": 3,
}


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch):
    monkeypatch.setattr(store_module, "REPLACE_BACKOFF_SECONDS", 0)


def leftover_temp_files(root):
    return [p.name for p in root.iterdir() if p.name.endswith(".tmp")]


# --- Root selection ------------------------------------------------------------


def test_default_root_reads_the_git_tracked_layers():
    set_layer_store(None)
    try:
        store = get_layer_store()
        assert env.MAPS_ROOT == "app/maps"
        assert str(store.root) == "app/maps"
        maps = store.read_index()
        assert maps is not None
        assert {entry["id"] for entry in maps} == {0, 1, 2, 3, 4, 5}
    finally:
        set_layer_store(None)


def test_custom_root_serves_only_its_enabled_layers(maps_root):
    maps_root.write_index([GFW, DISABLED])
    maps_root.write_attributes(
        "en", "gfw.json", {"name": "Global Forest Watch", "alias": "GFW"}
    )
    maps_root.write_considerations("en", "gfw.md", "  Some notes.\n")

    response = client.get("/maps")

    assert response.status_code == 200
    body = response.json()
    assert [layer["id"] for layer in body] == [0]
    assert body[0]["name"] == "Global Forest Watch"
    assert body[0]["considerations"] == "Some notes."
    assert body[0]["version"] == 1


def test_legacy_entries_default_to_enabled_version_1(maps_root):
    maps_root.write_index([GFW])

    [entry] = maps_root.store.read_index()

    assert entry["enabled"] is True
    assert entry["version"] == 1


def test_disabled_layer_is_still_resolvable_by_id(maps_root):
    maps_root.write_index([GFW, DISABLED])

    layer = get_map_by_id(7)

    assert layer is not None
    assert layer["enabled"] is False
    assert layer["raster_filename"] == "old-v3.tif"


def test_analysis_includes_disabled_layers(maps_root):
    maps_root.write_index([GFW, DISABLED])
    farm = {
        "id": "f1",
        "type": "point",
        "details": {"center": {"lat": -1.5, "lng": -78.5}, "radius": 50},
    }

    response = client.post(
        "/deforestation_analysis/analize", json={"maps": [7], "farms": [farm]}
    )

    # No raster file exists, so the value is None, but the disabled layer is analyzed.
    assert response.status_code == 200
    assert response.json() == [
        {"mapId": 7, "version": 3, "farmResults": [{"farmId": "f1", "value": None}]}
    ]


# --- Reads ---------------------------------------------------------------------


def test_metadata_reads(maps_root):
    maps_root.write_attributes("es", "gfw.json", {"name": "GFW es"})
    maps_root.write_considerations("es", "gfw.md", "\nNotas\n")

    assert read_attributes("gfw.json", "es") == {"name": "GFW es"}
    assert read_considerations("gfw.md", "es") == "Notas"
    assert read_attributes("missing.json", "es") is None
    assert read_considerations("missing.md", "es") is None


@pytest.mark.parametrize(
    "filename, language",
    [
        ("gfw.json", "../.."),
        ("gfw.json", "en/../../.."),
        ("../gfw.json", "en"),
        ("..", "en"),
        ("", "en"),
    ],
)
def test_metadata_paths_cannot_escape_the_root(maps_root, filename, language):
    maps_root.write_attributes("en", "gfw.json", {"name": "GFW"})

    assert read_attributes(filename, language) is None
    assert read_considerations(filename, language) is None


def test_raster_path(maps_root):
    path = maps_root.write_raster("gfw-v1.tif")

    assert get_map_raster_path("gfw-v1.tif") == str(path)
    with pytest.raises(FileNotFoundError):
        get_map_raster_path("missing.tif")
    with pytest.raises(FileNotFoundError):
        get_map_raster_path("../index.json")


def test_index_is_cached_until_the_file_changes(maps_root):
    maps_root.write_index([GFW])
    store = maps_root.store

    with patch.object(LayerStore, "_read_json", wraps=LayerStore._read_json) as spy:
        store.read_index()
        store.read_index()
        assert spy.call_count == 1

        # An out-of-band edit (different size and mtime) is picked up.
        maps_root.write_index([GFW, DISABLED])
        os.utime(store.index_path, ns=(1, 1))
        assert [entry["id"] for entry in store.read_index()] == [0, 7]
        assert spy.call_count == 2


def test_callers_cannot_mutate_the_cached_index(maps_root):
    maps_root.write_index([GFW])
    store = maps_root.store

    store.read_index()[0]["enabled"] = False

    assert store.read_index()[0]["enabled"] is True


def test_invalid_index_is_reported_as_unreadable(maps_root):
    (maps_root.root / "index.json").write_text("{not json", encoding="utf-8")

    assert maps_root.store.read_index() is None
    assert client.get("/maps").status_code == 500


# --- Atomic writes -------------------------------------------------------------


def test_write_index_round_trip(maps_root):
    store = maps_root.store

    store.write_index([GFW, DISABLED])

    on_disk = json.loads(store.index_path.read_text(encoding="utf-8"))
    assert [entry["id"] for entry in on_disk] == [0, 7]
    assert [entry["id"] for entry in store.read_index()] == [0, 7]
    assert leftover_temp_files(maps_root.root) == []


def test_failed_write_leaves_previous_index_and_no_partial_file(maps_root):
    maps_root.write_index([GFW])
    store = maps_root.store
    before = store.index_path.read_bytes()

    with patch(
        "app.modules.layers.store.os.replace",
        side_effect=OSError(errno.EIO, "I/O error"),
    ):
        with pytest.raises(OSError):
            store.write_index([GFW, DISABLED])

    assert store.index_path.read_bytes() == before
    assert leftover_temp_files(maps_root.root) == []


def test_refused_rename_is_retried(maps_root):
    maps_root.write_index([GFW])
    store = maps_root.store
    real_replace = os.replace
    calls = []

    def refuse_once(src, dst):
        calls.append(dst)
        if len(calls) == 1:
            raise PermissionError(errno.EACCES, "Permission denied")
        real_replace(src, dst)

    with patch("app.modules.layers.store.os.replace", side_effect=refuse_once):
        store.write_index([GFW, DISABLED])

    assert len(calls) == 2
    assert [entry["id"] for entry in json.loads(store.index_path.read_text())] == [0, 7]
    assert leftover_temp_files(maps_root.root) == []


def test_refused_rename_that_deletes_the_target_never_loses_the_index(maps_root):
    """Azure Files semantics: a refused rename over an open file deletes the target."""
    maps_root.write_index([GFW])
    store = maps_root.store

    def smb_refusal(src, dst):
        if os.path.exists(dst):
            os.remove(dst)
        raise PermissionError(errno.EACCES, "Permission denied")

    with patch("app.modules.layers.store.os.replace", side_effect=smb_refusal):
        store.write_index([GFW, DISABLED])

    assert [entry["id"] for entry in json.loads(store.index_path.read_text())] == [0, 7]
    assert leftover_temp_files(maps_root.root) == []


def test_persistently_refused_rename_keeps_the_existing_index(maps_root):
    maps_root.write_index([GFW])
    store = maps_root.store
    before = store.index_path.read_bytes()

    with patch(
        "app.modules.layers.store.os.replace",
        side_effect=PermissionError(errno.EACCES, "Permission denied"),
    ) as replace:
        with pytest.raises(PermissionError):
            store.write_index([GFW, DISABLED])

    assert replace.call_count == store_module.REPLACE_ATTEMPTS
    assert store.index_path.read_bytes() == before
    # On SMB the refused target may still vanish once a foreign handle closes it:
    # the intended index is kept next to it until someone restores it.
    (kept,) = leftover_temp_files(maps_root.root)
    assert json.loads((maps_root.root / kept).read_text()) == [GFW, DISABLED]


def test_rename_that_does_not_read_back_keeps_the_intended_contents(maps_root):
    maps_root.write_index([GFW])
    store = maps_root.store
    real_replace = os.replace

    def corrupt(src, dst):
        real_replace(src, dst)
        Path(dst).write_bytes(b"[]\n")

    with patch("app.modules.layers.store.os.replace", side_effect=corrupt):
        with pytest.raises(OSError, match="Read-back"):
            store.write_index([GFW, DISABLED])

    (kept,) = leftover_temp_files(maps_root.root)
    assert json.loads((maps_root.root / kept).read_text()) == [GFW, DISABLED]


def test_writes_never_change_permissions(maps_root):
    """chmod is not permitted on the Azure Files mount (EPERM)."""
    with patch("os.chmod", side_effect=PermissionError(errno.EPERM, "not permitted")):
        maps_root.store.write_index([GFW])

    assert maps_root.store.read_index()[0]["id"] == 0


# --- Health --------------------------------------------------------------------


def test_health_reports_the_maps_root(maps_root):
    body = client.get("/health").json()

    assert body["status"] == "OK"
    assert body["mapsRoot"] == str(maps_root.root.resolve())
    assert body["mapsRootWritable"] is True


def test_health_reports_a_missing_root_as_not_writable(tmp_path):
    set_layer_store(LayerStore(tmp_path / "does-not-exist"))
    try:
        assert client.get("/health").json()["mapsRootWritable"] is False
    finally:
        set_layer_store(None)
