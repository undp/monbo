import json
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from rasterio.transform import from_origin

from app.main import create_app
from app.modules.admin.auth import Session
from app.modules.admin.layers import create_layer
from app.modules.admin.models import LayerInput
from tests.modules.admin.support import COUNTRY_PASSKEYS, bearer, login

GFW = {
    "id": 0,
    "raster_filename": "gfw.tif",
    "attributes_filename": "gfw.json",
    "considerations_filename": "gfw.md",
    "pixel_size": 30,
    "baseline": "2020",
    "compared_against": "2023",
    "references": ["https://glad.earthengine.app/view/global-forest-change"],
}
HIDDEN = {
    **GFW,
    "id": 5,
    "raster_filename": "hidden-v2.tif",
    "attributes_filename": "hidden.json",
    "considerations_filename": "hidden.md",
    "enabled": False,
    "version": 2,
}


# Ecuador's own layers: a CO admin must never see or change them.
MAATE = {
    **GFW,
    "id": 2,
    "raster_filename": "ecuador.tif",
    "attributes_filename": "ecuador.json",
    "considerations_filename": "ecuador.md",
}


@pytest.fixture
def layers(colombia, country_root):
    colombia.write_index([GFW, HIDDEN])
    for language, name in (("en", "Global Forest Watch"), ("es", "GFW es")):
        colombia.write_attributes(
            language, "gfw.json", {"name": name, "alias": "GFW 2020-2023"}
        )
        colombia.write_considerations(language, "gfw.md", f"notes {language}")
    colombia.write_raster("gfw.tif")
    colombia.write_raster("hidden-v2.tif")
    ecuador = country_root.country("EC")
    ecuador.write_index([MAATE])
    ecuador.write_considerations("es", "ecuador.md", "notas de Ecuador")
    ecuador.write_raster("ecuador.tif")
    return colombia


def ecuador_headers(client):
    return bearer(login(client, passkey=COUNTRY_PASSKEYS["EC"]).json()["token"])


def layer_body(**overrides):
    body = {
        "pixel_size": 30,
        "baseline": 2020,
        "compared_against": 2024,
        "references": ["https://example.org/layer"],
        "attributes": {
            "en": {"name": "New layer", "alias": "NEW 2020-2024", "source": "Test"},
            "es": {"name": "Capa nueva", "alias": "NUEVA 2020-2024"},
        },
        "considerations": {"en": "## Notes", "es": "## Notas"},
    }
    body.update(overrides)
    return body


def index_ids(country):
    return [entry["id"] for entry in json.loads(country.store.index_path.read_text())]


# --- Access ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("get", "/admin/layers", None),
        ("post", "/admin/layers", layer_body()),
        ("put", "/admin/layers/0", layer_body()),
        ("patch", "/admin/layers/0", {"enabled": False}),
    ],
)
def test_layer_routes_require_an_admin_session(layers, client, method, path, body):
    kwargs = {"json": body} if body is not None else {}

    assert getattr(client, method)(path, **kwargs).status_code == 401


# --- List ------------------------------------------------------------------------


def test_list_includes_disabled_layers_and_every_language(
    layers, client, admin_headers
):
    response = client.get("/admin/layers", headers=admin_headers)

    assert response.status_code == 200
    by_id = {layer["id"]: layer for layer in response.json()}
    assert set(by_id) == {0, 5}
    gfw = by_id[0]
    assert gfw["enabled"] is True
    assert gfw["has_raster"] is True
    assert gfw["baseline"] == 2020
    assert gfw["attributes"]["en"]["name"] == "Global Forest Watch"
    assert gfw["attributes"]["es"]["name"] == "GFW es"
    assert gfw["considerations"] == {"en": "notes en", "es": "notes es"}
    hidden = by_id[5]
    assert hidden["enabled"] is False
    assert hidden["version"] == 2
    # Its metadata files don't exist in this fixture.
    assert hidden["attributes"] == {"en": None, "es": None}


def test_list_only_has_the_session_country(layers, client, admin_headers):
    colombia = client.get("/admin/layers", headers=admin_headers).json()
    ecuador = client.get("/admin/layers", headers=ecuador_headers(client)).json()

    assert {layer["id"] for layer in colombia} == {0, 5}
    assert {layer["id"] for layer in ecuador} == {2}
    assert "available_countries_codes" not in colombia[0]


# --- Create ----------------------------------------------------------------------


def test_create_assigns_the_next_id_and_starts_disabled(layers, client, admin_headers):
    response = client.post("/admin/layers", json=layer_body(), headers=admin_headers)

    assert response.status_code == 201
    layer = response.json()
    assert layer["id"] == 6
    assert layer["enabled"] is False
    assert layer["version"] == 0  # the first raster makes it 1
    assert layer["raster_filename"] is None
    assert layer["has_raster"] is False
    assert layer["attributes"]["es"]["alias"] == "NUEVA 2020-2024"
    assert layer["considerations"] == {"en": "## Notes", "es": "## Notas"}

    root = layers.root / "metadata"
    stored = json.loads((root / "attributes" / "en" / "layer-6.json").read_text())
    assert stored == {"name": "New layer", "alias": "NEW 2020-2024", "source": "Test"}
    assert (root / "considerations" / "es" / "layer-6.md").read_text() == "## Notas\n"
    entry = json.loads(layers.store.index_path.read_text())[-1]
    assert entry["baseline"] == "2020"  # stored like the existing entries
    assert entry["pixel_size"] == 30
    assert "available_countries_codes" not in entry

    public = TestClient(create_app()).get("/maps").json()
    assert 6 not in [layer["id"] for layer in public]


def test_ids_are_numbered_within_the_country(
    layers, country_root, client, admin_headers
):
    # Ecuador's ids don't matter to Colombia's.
    country_root.country("EC").write_index(
        [MAATE, {**MAATE, "id": 12, "enabled": False}]
    )

    colombia = client.post("/admin/layers", json=layer_body(), headers=admin_headers)
    ecuador = client.post(
        "/admin/layers", json=layer_body(), headers=ecuador_headers(client)
    )

    assert colombia.json()["id"] == 6
    assert ecuador.json()["id"] == 13
    assert index_ids(layers) == [0, 5, 6]


@pytest.mark.parametrize(
    "overrides",
    [
        {"baseline": 2023, "compared_against": 2020},
        {"pixel_size": 0},
        # A layer belongs to the session's country: no countries field.
        {"available_countries_codes": ["CO"]},
        {"references": ["ftp://example.org/layer"]},
        {"attributes": {"en": {"name": "Only en", "alias": "EN"}}},
        {
            "attributes": {
                "en": {"name": "New", "alias": "NEW"},
                "es": {"name": "Nueva", "alias": ""},
            }
        },
        {"enabled": True},  # not settable here
    ],
)
def test_invalid_layers_are_rejected_and_nothing_is_written(
    layers, client, admin_headers, overrides
):
    before = layers.store.index_path.read_bytes()

    response = client.post(
        "/admin/layers", json=layer_body(**overrides), headers=admin_headers
    )

    assert response.status_code == 422
    assert layers.store.index_path.read_bytes() == before
    assert not list(layers.root.rglob("layer-*"))


def test_concurrent_creates_get_distinct_ids(layers):
    body = LayerInput.model_validate(layer_body())
    session = Session(0, 0, "CO", "0" * 16)

    with ThreadPoolExecutor(max_workers=8) as pool:
        created = list(pool.map(lambda _: create_layer(body, session).id, range(8)))

    assert sorted(created) == list(range(6, 14))
    assert index_ids(layers) == [0, 5, *range(6, 14)]


# --- Edit ------------------------------------------------------------------------


def test_edit_updates_metadata_in_place(layers, client, admin_headers):
    body = layer_body(
        baseline=2021,
        attributes={
            "en": {"name": "Global Forest Watch", "alias": "GFW 2021-2024"},
            "es": {"name": "Global Forest Watch", "alias": "GFW 2021-2024"},
        },
        considerations={"en": "new en notes", "es": "nuevas notas"},
    )

    response = client.put("/admin/layers/0", json=body, headers=admin_headers)

    assert response.status_code == 200
    layer = response.json()
    assert layer["baseline"] == 2021
    # Written to the layer's existing files, not to layer-0.*
    considerations = layers.root / "metadata" / "considerations"
    assert (considerations / "es" / "gfw.md").read_text() == "nuevas notas\n"
    assert not list(layers.root.rglob("layer-*"))
    # Not editable here.
    assert layer["raster_filename"] == "gfw.tif"
    assert layer["version"] == 1
    assert layer["enabled"] is True

    public = TestClient(create_app()).get("/maps?language=es").json()
    gfw = next(layer for layer in public if layer["id"] == 0)
    assert gfw["considerations"] == "nuevas notas"
    assert gfw["alias"] == "GFW 2021-2024"
    assert gfw["baseline"] == 2021
    assert gfw["pixelSize"] == 30


def test_removing_considerations_deletes_the_file(layers, client, admin_headers):
    body = layer_body(considerations={"en": "keep", "es": None})

    client.put("/admin/layers/0", json=body, headers=admin_headers)

    considerations = layers.root / "metadata" / "considerations"
    assert (considerations / "en" / "gfw.md").exists()
    assert not (considerations / "es" / "gfw.md").exists()


def test_edit_unknown_layer_is_404(layers, client, admin_headers):
    response = client.put("/admin/layers/999", json=layer_body(), headers=admin_headers)

    assert response.status_code == 404


def test_another_countrys_layer_cannot_be_edited(
    layers, country_root, client, admin_headers
):
    ecuador = country_root.root / "EC"
    before = (ecuador / "index.json").read_bytes()

    response = client.put("/admin/layers/2", json=layer_body(), headers=admin_headers)

    assert response.status_code == 404
    assert (ecuador / "index.json").read_bytes() == before
    assert not (ecuador / "metadata" / "attributes").exists()
    considerations = ecuador / "metadata" / "considerations" / "es" / "ecuador.md"
    assert considerations.read_text() == "notas de Ecuador"


def test_editing_a_copy_leaves_the_other_countries_alone(layers, country_root, client):
    """GFW is copied into each country: editing Ecuador's copy only changes it."""
    ecuador = country_root.country("EC")
    ecuador.write_index([MAATE, {**GFW, "id": 6}])
    body = layer_body(considerations={"en": "EC notes", "es": "notas EC"})

    response = client.put("/admin/layers/6", json=body, headers=ecuador_headers(client))

    assert response.status_code == 200
    considerations = "metadata/considerations/es/gfw.md"
    assert (ecuador.root / considerations).read_text() == "notas EC\n"
    assert (layers.root / considerations).read_text() == "notes es"


def test_edit_rejects_pixel_size_that_disagrees_with_existing_raster(
    layers, client, admin_headers
):
    with rasterio.open(
        layers.store.rasters_dir / "gfw.tif",
        "w",
        driver="GTiff",
        width=16,
        height=16,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_origin(-76.5, -0.2, 0.00027, 0.00027),
    ) as raster:
        raster.write(np.zeros((16, 16), dtype="uint8"), 1)
    original_index = layers.store.index_path.read_bytes()
    original_attributes = (
        layers.root / "metadata" / "attributes" / "en" / "gfw.json"
    ).read_bytes()

    response = client.put(
        "/admin/layers/0",
        json=layer_body(pixel_size=10),
        headers=admin_headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "resolution_mismatch"
    assert layers.store.index_path.read_bytes() == original_index
    assert (
        layers.root / "metadata" / "attributes" / "en" / "gfw.json"
    ).read_bytes() == original_attributes


# --- Enable / disable ------------------------------------------------------------


def test_disable_hides_the_layer_from_the_public_listing(layers, client, admin_headers):
    response = client.patch(
        "/admin/layers/0", json={"enabled": False}, headers=admin_headers
    )

    assert response.status_code == 200
    assert response.json()["enabled"] is False
    public = TestClient(create_app()).get("/maps").json()
    assert 0 not in [layer["id"] for layer in public]


def test_enable_a_layer_with_a_raster(layers, client, admin_headers):
    response = client.patch(
        "/admin/layers/5", json={"enabled": True}, headers=admin_headers
    )

    assert response.status_code == 200
    public = TestClient(create_app()).get("/maps").json()
    assert 5 in [layer["id"] for layer in public]


def test_enabling_without_a_raster_is_409(layers, client, admin_headers):
    layer_id = client.post(
        "/admin/layers", json=layer_body(), headers=admin_headers
    ).json()["id"]

    response = client.patch(
        f"/admin/layers/{layer_id}", json={"enabled": True}, headers=admin_headers
    )

    assert response.status_code == 409
    listing = client.get("/admin/layers", headers=admin_headers).json()
    assert (
        next(layer for layer in listing if layer["id"] == layer_id)["enabled"] is False
    )


def test_patch_unknown_layer_is_404(layers, client, admin_headers):
    response = client.patch(
        "/admin/layers/999", json={"enabled": False}, headers=admin_headers
    )

    assert response.status_code == 404


def test_another_countrys_layer_cannot_be_hidden(layers, client, admin_headers):
    response = client.patch(
        "/admin/layers/2", json={"enabled": False}, headers=admin_headers
    )

    assert response.status_code == 404
    public = TestClient(create_app()).get("/maps?country=EC").json()
    assert [layer["id"] for layer in public] == [2]


def test_raster_less_layer_tiles_are_404_not_500(layers, client, admin_headers):
    layer_id = client.post(
        "/admin/layers", json=layer_body(), headers=admin_headers
    ).json()["id"]

    response = client.get(
        f"/deforestation_analysis/tiles/CO/{layer_id}/dynamic/12/1/1.png"
    )

    assert response.status_code == 404
