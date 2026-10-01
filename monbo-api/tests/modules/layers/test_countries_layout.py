"""The per-country layout: detection, registry, ids numbered within each country and
the public routes that depend on it (`/maps?country=`, `/countries`, and the country
in analysis, tiles and image generation)."""

import json
import logging
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.layers.store import (
    LayersRoot,
    LayerStore,
    LayoutError,
    get_layers_root,
    set_layers_root,
)
from app.modules.maps.helpers import get_map_by_id
from app.utils.maps import get_map_raster_path


def layer(layer_id, raster, **overrides):
    stem = raster.removesuffix(".tif")
    return {
        "id": layer_id,
        "raster_filename": raster,
        "attributes_filename": f"{stem}.json",
        "considerations_filename": f"{stem}.md",
        "pixel_size": 30,
        "baseline": "2020",
        "compared_against": "2023",
        "references": [],
        **overrides,
    }


@pytest.fixture
def countries(country_root):
    """Layers like today's after the migration (each country numbers from 0), plus
    a hidden Ecuadorian layer."""
    country_root.register("CO", "EC", "CR")
    country_root.country("EC").write_index(
        [
            layer(0, "gfw.tif"),
            layer(1, "ecuador.tif"),
            layer(2, "hidden.tif", enabled=False),
        ]
    )
    country_root.country("CO").write_index([layer(0, "gfw.tif"), layer(1, "ideam.tif")])
    country_root.country("CR").write_index(
        [layer(0, "gfw.tif"), layer(1, "mocupp.tif")]
    )
    for code, raster in (("EC", "gfw.tif"), ("CO", "gfw.tif"), ("CR", "gfw.tif")):
        country_root.country(code).write_raster(raster, code.encode())
    country_root.country("CR").write_attributes(
        "es", "mocupp.json", {"name": "MOCUPP", "alias": "MOCUPP 2021-2022"}
    )
    return country_root


def public(path):
    return TestClient(create_app()).get(path)


# --- Layout --------------------------------------------------------------------


def test_layout_detection(tmp_path):
    flat = tmp_path / "flat"
    flat.mkdir()
    (flat / "index.json").write_text("[]")
    assert LayersRoot(flat).is_per_country() is False

    per_country = tmp_path / "per-country"
    per_country.mkdir()
    (per_country / "countries.json").write_text('{"countries": []}')
    assert LayersRoot(per_country).is_per_country() is True

    empty = LayersRoot(tmp_path / "empty")
    assert empty.is_per_country() is False
    assert empty.layers() is None


def test_a_root_with_both_layouts_refuses_to_start(country_root):
    country_root.register("CO")
    (country_root.root / "index.json").write_text("[]")

    with pytest.raises(LayoutError, match="index.json and countries.json"):
        create_app()


@pytest.mark.parametrize("code", ["co", "../x", "COL", "", "C/"])
def test_country_folders_must_be_uppercase_codes(country_root, code):
    with pytest.raises(ValueError):
        country_root.layers_root.country_store(code)


def test_layers_carry_their_country(countries):
    layers = {
        (entry["country"], entry["id"]): entry for entry in get_layers_root().layers()
    }

    assert sorted(layers) == [
        ("CO", 0),
        ("CO", 1),
        ("CR", 0),
        ("CR", 1),
        ("EC", 0),
        ("EC", 1),
        ("EC", 2),
    ]
    assert layers["CO", 1]["raster_filename"] == "ideam.tif"
    assert layers["CO", 1]["available_countries_codes"] == ["CO"]
    assert layers["EC", 2]["enabled"] is False
    # Not written back into the country's index.
    stored = json.loads((countries.root / "CO" / "index.json").read_text())
    assert "country" not in stored[0]
    assert "available_countries_codes" not in stored[0]


def test_a_layer_is_found_by_country_and_id(countries):
    assert get_map_by_id(1, "CO")["raster_filename"] == "ideam.tif"
    assert get_map_by_id(1, "CR")["raster_filename"] == "mocupp.tif"
    assert get_map_by_id(2, "CO") is None
    assert get_map_by_id(1, "PE") is None
    with pytest.raises(HTTPException) as error:
        get_map_by_id(1)
    assert error.value.status_code == 422


# --- Registry --------------------------------------------------------------------


def test_registry_is_cached_until_the_file_changes(countries):
    root = countries.layers_root
    with patch.object(LayerStore, "_read_json", wraps=LayerStore._read_json) as spy:
        root.read_registry()
        root.read_registry()
        registry_reads = [
            c for c in spy.call_args_list if c.args[0] == root.registry_path
        ]
    assert len(registry_reads) == 1


def test_a_corrupted_registry_keeps_the_last_valid_one(countries, caplog):
    root = countries.layers_root
    assert [c["code"] for c in root.read_registry()] == ["CO", "EC", "CR"]

    root.registry_path.write_text("{ not json")
    with caplog.at_level(logging.ERROR, logger="app"):
        registry = root.read_registry()

    assert [c["code"] for c in registry] == ["CO", "EC", "CR"]
    assert "Invalid country registry" in caplog.text
    # The public routes keep working.
    assert public("/maps?country=CR").status_code == 200


@pytest.mark.parametrize(
    "countries_field",
    [
        [{"code": "co", "passkey_hash": "a" * 64, "enabled": True}],
        [{"code": "CO", "passkey_hash": "not-a-hash", "enabled": True}],
        [{"code": "CO", "passkey_hash": "a" * 64}],
        [
            {"code": "CO", "passkey_hash": "a" * 64, "enabled": True},
            {"code": "CO", "passkey_hash": "b" * 64, "enabled": True},
        ],
    ],
)
def test_invalid_registries_are_not_written(country_root, countries_field):
    with pytest.raises(ValueError):
        country_root.layers_root.write_registry(countries_field)


# --- Public listing ----------------------------------------------------------------


def test_maps_filtered_by_country(countries):
    response = public("/maps?country=CR&language=es")

    assert response.status_code == 200
    layers = response.json()
    assert [entry["id"] for entry in layers] == [0, 1]
    assert all(entry["availableCountriesCodes"] == ["CR"] for entry in layers)
    assert layers[1]["alias"] == "MOCUPP 2021-2022"


def test_maps_of_an_unknown_country_is_empty(countries):
    assert public("/maps?country=PE").json() == []


@pytest.mark.parametrize("contents", [None, "{ invalid json"])
def test_unreadable_country_index_does_not_publish_partial_lists(countries, contents):
    index = countries.root / "CR" / "index.json"
    if contents is None:
        index.unlink()
    else:
        index.write_text(contents)

    for path in ("/maps?country=CO", "/countries"):
        response = public(path)
        assert response.status_code == 500
        assert response.json() == {"detail": "Failed to read map data"}


def test_a_disabled_country_disappears_from_the_listing(countries):
    registry = countries.layers_root.read_registry()
    for country in registry:
        country["enabled"] = country["code"] != "EC"
    countries.write_registry(registry)

    assert public("/maps?country=EC").json() == []
    listed = {
        (entry["availableCountriesCodes"][0], entry["id"])
        for entry in public("/maps").json()
    }
    assert listed == {("CO", 0), ("CO", 1), ("CR", 0), ("CR", 1)}
    # Still resolvable for analyses and tiles.
    assert get_map_by_id(0, "EC")["country"] == "EC"


def test_copied_layers_resolve_to_their_own_folder(countries):
    for code in ("EC", "CO", "CR"):
        path = get_map_raster_path(get_map_by_id(0, code))
        assert path == str(countries.root / code / "layers" / "rasters" / "gfw.tif")


def analysis(body):
    return TestClient(create_app()).post("/deforestation_analysis/analize", json=body)


def test_analysis_needs_the_country(countries):
    response = analysis({"maps": [0], "farms": []})

    assert response.status_code == 422
    assert response.json() == {"detail": "country is required"}


def test_analysis_uses_the_layers_of_its_country(countries):
    response = analysis({"country": "CR", "maps": [0, 1], "farms": []})

    assert response.status_code == 200
    assert [result["mapId"] for result in response.json()] == [0, 1]


def test_analysis_rejects_ids_its_country_doesnt_have(countries):
    # CR has layers 0 and 1: an empty "successful" result would hide the mistake.
    response = analysis({"country": "CR", "maps": [0, 2], "farms": []})

    assert response.status_code == 400
    assert "[2]" in response.json()["detail"]


@pytest.mark.parametrize("country", ["co", "COL", "C0", ""])
def test_malformed_country_codes_are_422(countries, country):
    client = TestClient(create_app())

    assert analysis({"country": country, "maps": [0], "farms": []}).status_code == 422
    assert client.get(f"/maps?country={country}").status_code == 422
    assert client.get(
        f"/deforestation_analysis/tiles/{country}/0/dynamic/12/1/1.png"
    ).status_code in (
        404,
        422,
    )  # "" doesn't even match the route
    image = client.post(
        "/deforestation_analysis/generate-image",
        json={"country": country, "mapId": 0, "feature": {}},
    )
    assert image.status_code == 422


def test_tiles_of_an_unknown_country_or_id_are_404(countries):
    client = TestClient(create_app())

    assert (
        client.get("/deforestation_analysis/tiles/PE/0/dynamic/12/1/1.png").status_code
        == 404
    )
    assert (
        client.get("/deforestation_analysis/tiles/CO/2/dynamic/12/1/1.png").status_code
        == 404
    )


# --- /countries --------------------------------------------------------------------


def test_countries_lists_enabled_countries_with_enabled_layers(countries):
    assert public("/countries").json() == [
        {"code": "CO"},
        {"code": "CR"},
        {"code": "EC"},
    ]


def test_a_country_without_enabled_layers_is_not_listed(countries):
    countries.country("CR").write_index([layer(1, "mocupp.tif", enabled=False)])
    registry = countries.layers_root.read_registry()
    countries.write_registry(
        [*registry, {"code": "PE", "passkey_hash": "a" * 64, "enabled": True}]
    )
    countries.country("PE").write_index([])

    codes = [entry["code"] for entry in public("/countries").json()]

    assert codes == ["CO", "EC"]


def test_countries_on_a_flat_root(maps_root):
    maps_root.write_index(
        [
            layer(0, "gfw.tif", available_countries_codes=["EC", "CO"]),
            layer(1, "hidden.tif", available_countries_codes=["PE"], enabled=False),
        ]
    )

    assert public("/countries").json() == [{"code": "CO"}, {"code": "EC"}]
    assert [entry["id"] for entry in public("/maps?country=CO").json()] == [0]
    assert public("/maps?country=PE").json() == []
    # Global ids here: the country is optional, and must be one the layer lists.
    assert get_map_by_id(0)["raster_filename"] == "gfw.tif"
    assert get_map_by_id(0, "EC")["raster_filename"] == "gfw.tif"
    assert get_map_by_id(0, "CR") is None


def test_the_git_tracked_layers_are_served_as_a_flat_root():
    set_layers_root(None)
    try:
        assert public("/countries").json() == [
            {"code": "CO"},
            {"code": "CR"},
            {"code": "EC"},
        ]
        colombia = public("/maps?country=CO").json()
        assert {entry["id"] for entry in colombia} == {0, 1, 3}
    finally:
        set_layers_root(None)


def test_one_countrys_broken_index_only_breaks_that_country(countries):
    """Analysis, tiles and images read only their country's index."""
    (countries.root / "EC" / "index.json").write_text("{ invalid json")

    assert analysis({"country": "CR", "maps": [0, 1], "farms": []}).status_code == 200
    assert get_map_by_id(1, "CR")["raster_filename"] == "mocupp.tif"
    with pytest.raises(HTTPException) as error:
        get_map_by_id(0, "EC")
    assert error.value.status_code == 500
    assert get_map_by_id(0, "PE") is None  # not registered


def test_a_tile_reads_only_its_countrys_index(countries):
    reads = []
    real = LayerStore.read_index

    def spy(self):
        reads.append(self.root.name)
        return real(self)

    with patch.object(LayerStore, "read_index", spy):
        get_map_by_id(1, "CR")

    assert reads == ["CR"]
