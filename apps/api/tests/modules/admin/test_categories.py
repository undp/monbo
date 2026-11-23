"""Category administration: `/admin/categories`, scoped to the session's country,
and the rules that keep a published layer's meaning stable."""

import json

import pytest

from tests.modules.admin.support import (
    COUNTRY_PASSKEYS,
    bearer,
    login,
    write_categories,
)
from tests.modules.admin.test_layers import GFW, HIDDEN, layer_body
from tests.modules.layers.test_categories import category


def stored(country):
    return json.loads((country.root / "categories.json").read_text())


def category_body(name_es=None, **overrides):
    """A category's fields. `name_es` is the Spanish name, which a new category's id
    comes from: "Protected areas" → `protected_areas`."""
    body = {
        "name": {"es": "Áreas protegidas", "en": "Protected areas"},
        "description": {"es": "Áreas del registro nacional", "en": "National registry"},
        "icon": "shield",
        "color": "#1565c0",
        "polarity": "avoid",
        "thresholdPercentage": 0,
        "resultLabels": {
            "ok": {"es": "Fuera de áreas protegidas", "en": "Outside protected areas"},
            "flagged": {"es": "En área protegida", "en": "In a protected area"},
        },
        "temporal": False,
    }
    if name_es is not None:
        body["name"] = {"es": name_es, "en": "Protected areas"}
    body.update(overrides)
    return body


def ecuador_headers(client):
    return bearer(login(client, passkey=COUNTRY_PASSKEYS["EC"]).json()["token"])


def admin_categories(client, headers):
    response = client.get("/admin/categories", headers=headers)
    assert response.status_code == 200
    return response.json()


def by_id(client, headers):
    return {c["id"]: c for c in admin_categories(client, headers)["categories"]}


def public_ids(client, country="CO"):
    return [c["id"] for c in client.get(f"/categories?country={country}").json()]


RUNAP = {
    **GFW,
    "id": 6,
    "raster_filename": "runap.tif",
    "attributes_filename": "runap.json",
    "considerations_filename": "runap.md",
    "category_id": "protected_areas",
    "baseline": None,
    "compared_against": None,
}


@pytest.fixture
def colombia_layers(colombia, country_root):
    """CO: GFW (published) and a hidden layer, both deforestation. EC: one layer of
    its own category."""
    colombia.write_index([GFW, HIDDEN])
    colombia.write_raster("gfw.tif")
    colombia.write_raster("hidden-v2.tif")
    ecuador = country_root.country("EC")
    # A public layer of its own (not temporal: no years), so EC is offered.
    ecuador.write_index(
        [{**GFW, "category_id": "snap_ec", "baseline": None, "compared_against": None}]
    )
    ecuador.write_raster("gfw.tif")
    write_categories(ecuador, [category("snap_ec")])
    return colombia


@pytest.fixture
def protected_areas(colombia_layers):
    """CO also has `protected_areas` (not temporal) with the published layer 6."""
    colombia_layers.write_index([GFW, HIDDEN, RUNAP])
    colombia_layers.write_raster("runap.tif")
    write_categories(colombia_layers, [category("protected_areas")])
    return colombia_layers


# --- Access ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("get", "/admin/categories", None),
        ("post", "/admin/categories", category_body("Frontier")),
        ("put", "/admin/categories/deforestation", category_body()),
        ("patch", "/admin/categories/deforestation", {"enabled": False}),
    ],
)
def test_category_routes_require_an_admin_session(
    colombia_layers, client, method, path, body
):
    kwargs = {"json": body} if body is not None else {}

    assert getattr(client, method)(path, **kwargs).status_code == 401


# --- List ------------------------------------------------------------------------


def test_a_country_without_categories_lists_the_built_in_one(
    colombia_layers, client, admin_headers
):
    response = admin_categories(client, admin_headers)

    assert response["readable"] is True
    assert response["errors"] == []
    [deforestation] = response["categories"]
    assert deforestation["id"] == "deforestation"
    assert deforestation["thresholdPercentage"] is None  # the global one
    assert deforestation["enabled"] is True
    assert deforestation["polarity"] == "avoid"
    assert deforestation["name"] == {"es": "Deforestación", "en": "Deforestation"}
    assert deforestation["layerCount"] == 2
    assert deforestation["publishedLayerCount"] == 1


def test_the_list_only_has_the_session_country(protected_areas, client, admin_headers):
    assert set(by_id(client, admin_headers)) == {"deforestation", "protected_areas"}
    assert set(by_id(client, ecuador_headers(client))) == {"deforestation", "snap_ec"}


def test_the_list_includes_disabled_categories(colombia_layers, client, admin_headers):
    write_categories(colombia_layers, [category("frontier", enabled=False)])

    assert by_id(client, admin_headers)["frontier"]["enabled"] is False
    assert "frontier" not in public_ids(client)


def test_a_rejected_entry_is_reported_not_listed(
    colombia_layers, client, admin_headers
):
    write_categories(
        colombia_layers, [category("frontier", polarity="inside"), category("ok")]
    )

    response = admin_categories(client, admin_headers)

    assert [c["id"] for c in response["categories"]] == ["deforestation", "ok"]
    assert response["readable"] is True
    [error] = response["errors"]
    assert "frontier" in error and "polarity" in error


def test_an_unreadable_file_is_reported(colombia_layers, client, admin_headers):
    write_categories(colombia_layers, "{ not json")

    response = admin_categories(client, admin_headers)

    assert response["categories"] == []
    assert response["readable"] is False
    assert "not valid JSON" in response["errors"][0]


# --- Create ----------------------------------------------------------------------


def test_create_a_category(colombia_layers, client, admin_headers):
    response = client.post(
        "/admin/categories",
        json=category_body("Protected areas"),
        headers=admin_headers,
    )

    assert response.status_code == 201
    created = response.json()
    assert created["id"] == "protected_areas"
    assert created["enabled"] is True
    assert created["thresholdPercentage"] == 0
    assert created["layerCount"] == 0
    assert [c["id"] for c in stored(colombia_layers)] == ["protected_areas"]
    assert stored(colombia_layers)[0]["threshold_percentage"] == 0
    public = client.get("/categories?country=CO").json()
    assert [c["id"] for c in public] == ["deforestation", "protected_areas"]
    assert public[1]["thresholdPercentage"] == 0
    assert public[1]["resultLabels"]["flagged"]["es"] == "En área protegida"


def test_create_without_threshold_uses_the_global_one(
    colombia_layers, client, admin_headers
):
    body = category_body("Frontier", polarity="required")
    del body["thresholdPercentage"]

    response = client.post("/admin/categories", json=body, headers=admin_headers)

    assert response.status_code == 201
    assert response.json()["thresholdPercentage"] is None
    assert stored(colombia_layers)[0]["threshold_percentage"] is None


@pytest.mark.parametrize(
    "name_es, expected",
    [
        ("Frontera agrícola", "frontera_agricola"),
        ("  Áreas  protegidas (RUNAP) ", "areas_protegidas_runap"),
        ("1ª zona de reserva", "zona_de_reserva"),
        ("¡¡!!", "category"),
        ("a" * 60, "a" * 50),
    ],
)
def test_the_id_comes_from_the_spanish_name(
    colombia_layers, client, admin_headers, name_es, expected
):
    response = client.post(
        "/admin/categories", json=category_body(name_es), headers=admin_headers
    )

    assert response.status_code == 201
    assert response.json()["id"] == expected
    assert [c["id"] for c in stored(colombia_layers)] == [expected]


@pytest.mark.parametrize(
    "existing, name_es, expected",
    [
        ([category("frontier")], "Frontier", "frontier_2"),
        ([category("frontier", enabled=False)], "Frontier", "frontier_2"),
        ([category("frontier", polarity="inside")], "Frontier", "frontier_2"),
        ([category("frontier"), category("frontier_2")], "Frontier", "frontier_3"),
        ([category("a" * 50)], "a" * 60, "a" * 48 + "_2"),
        # `deforestation` is always taken, even built in, and `new` is the path of
        # the admin's create page, which would hide its edit page.
        ([], "Deforestation", "deforestation_2"),
        ([], "New", "new_2"),
    ],
)
def test_a_used_or_reserved_id_gets_a_number(
    colombia_layers, client, admin_headers, existing, name_es, expected
):
    write_categories(colombia_layers, existing)

    response = client.post(
        "/admin/categories", json=category_body(name_es), headers=admin_headers
    )

    assert response.status_code == 201
    assert response.json()["id"] == expected
    assert stored(colombia_layers)[-1]["id"] == expected


@pytest.mark.parametrize(
    "overrides",
    [
        {"polarity": "inside"},
        {"color": "red"},
        {"icon": "unicorn"},
        {"thresholdPercentage": 120},
        {"thresholdPercentage": -1},
        {"id": "frontier"},  # the API makes it
        {"enabled": False},  # only through PATCH
        {"name": {"es": "Solo español"}},
        {"name": {"es": "", "en": "Empty"}},
        {"resultLabels": {"ok": {"es": "x" * 61, "en": "ok"}, "flagged": None}},
    ],
)
def test_invalid_categories_are_422_and_nothing_is_written(
    colombia_layers, client, admin_headers, overrides
):
    response = client.post(
        "/admin/categories",
        json=category_body("Frontier", **overrides),
        headers=admin_headers,
    )

    assert response.status_code == 422
    assert not (colombia_layers.root / "categories.json").exists()


def test_the_same_id_in_another_country(protected_areas, country_root, client):
    colombia_before = stored(protected_areas)

    response = client.post(
        "/admin/categories",
        json=category_body("Protected areas", color="#2e7d32"),
        headers=ecuador_headers(client),
    )

    assert response.status_code == 201
    ecuador = json.loads((country_root.root / "EC" / "categories.json").read_text())
    assert [c["id"] for c in ecuador] == ["snap_ec", "protected_areas"]
    assert stored(protected_areas) == colombia_before


WETLANDS = {**GFW, "id": 8, "category_id": "wetlands"}  # a hand edit: no category


def test_creating_a_category_doesnt_publish_its_orphan_layers(
    colombia_layers, client, admin_headers
):
    # Regression (re-review of #138): layer 8 is enabled but hidden by
    # `unknown_category`; creating `wetlands` published it with years that don't
    # fit and a polarity it was never published with.
    colombia_layers.write_index([GFW, HIDDEN, WETLANDS])
    assert all(m["id"] != 8 for m in client.get("/maps?country=CO").json())

    response = client.post(
        "/admin/categories",
        json=category_body("Wetlands", temporal=False, polarity="required"),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(8)" in response.json()["detail"]
    assert not (colombia_layers.root / "categories.json").exists()
    assert all(m["id"] != 8 for m in client.get("/maps?country=CO").json())


def test_creating_a_category_over_hidden_layers_needs_their_years_to_fit(
    colombia_layers, client, admin_headers
):
    colombia_layers.write_index([GFW, HIDDEN, {**WETLANDS, "enabled": False}])

    response = client.post(
        "/admin/categories",
        json=category_body("Wetlands", temporal=False),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(8)" in response.json()["detail"]
    assert not (colombia_layers.root / "categories.json").exists()


def test_a_category_created_over_hidden_layers_publishes_them_through_patch(
    colombia_layers, client, admin_headers
):
    colombia_layers.write_index([GFW, HIDDEN, {**WETLANDS, "enabled": False}])

    created = client.post(
        "/admin/categories",
        json=category_body("Wetlands", temporal=True),
        headers=admin_headers,
    )

    assert created.status_code == 201
    assert created.json()["layerCount"] == 1
    assert created.json()["publishedLayerCount"] == 0
    assert all(m["id"] != 8 for m in client.get("/maps?country=CO").json())
    published = client.patch(
        "/admin/layers/8", json={"enabled": True}, headers=admin_headers
    )
    assert published.status_code == 200
    assert any(m["id"] == 8 for m in client.get("/maps?country=CO").json())


# --- Edit ------------------------------------------------------------------------


def test_editing_the_built_in_category_stores_it_first(
    protected_areas, client, admin_headers
):
    body = category_body(
        name={"es": "Deforestación", "en": "Deforestation"},
        icon="forest",
        color="#c62828",
        thresholdPercentage=5,
        temporal=True,
    )

    response = client.put(
        "/admin/categories/deforestation", json=body, headers=admin_headers
    )

    assert response.status_code == 200
    assert response.json()["publishedLayerCount"] == 1
    assert [c["id"] for c in stored(protected_areas)] == [
        "deforestation",
        "protected_areas",
    ]
    public = client.get("/categories?country=CO").json()
    assert public[0]["id"] == "deforestation"
    assert public[0]["thresholdPercentage"] == 5


def test_texts_threshold_icon_and_color_change_with_published_layers(
    protected_areas, client, admin_headers
):
    body = category_body(
        name={"es": "Parques", "en": "Parks"}, icon="forest", thresholdPercentage=3
    )

    response = client.put(
        "/admin/categories/protected_areas", json=body, headers=admin_headers
    )

    assert response.status_code == 200
    assert stored(protected_areas)[0]["name"] == {"es": "Parques", "en": "Parks"}
    assert stored(protected_areas)[0]["enabled"] is True


def test_polarity_cant_change_with_published_layers(
    protected_areas, client, admin_headers
):
    before = stored(protected_areas)

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(polarity="required"),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(6)" in response.json()["detail"]
    assert stored(protected_areas) == before


def test_polarity_changes_once_the_layers_are_hidden(
    protected_areas, client, admin_headers
):
    assert (
        client.patch(
            "/admin/layers/6", json={"enabled": False}, headers=admin_headers
        ).status_code
        == 200
    )

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(polarity="required"),
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert stored(protected_areas)[0]["polarity"] == "required"


def test_temporal_cant_change_with_any_layer(protected_areas, client, admin_headers):
    client.patch("/admin/layers/6", json={"enabled": False}, headers=admin_headers)

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(temporal=True),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert stored(protected_areas)[0]["temporal"] is False


def test_temporal_changes_without_layers(colombia_layers, client, admin_headers):
    write_categories(colombia_layers, [category("frontier")])

    response = client.put(
        "/admin/categories/frontier",
        json=category_body(temporal=True),
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert stored(colombia_layers)[0]["temporal"] is True


def test_a_rejected_entry_is_repaired(protected_areas, client, admin_headers):
    without_id = {"name": "no id"}
    write_categories(
        protected_areas,
        [category("protected_areas"), without_id, category("protected_areas")],
    )
    client.patch("/admin/layers/6", json={"enabled": False}, headers=admin_headers)
    layer = next(
        entry
        for entry in client.get("/admin/layers", headers=admin_headers).json()
        if entry["id"] == 6
    )
    assert layer["category_issue"] == "invalid_category"

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(),
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert stored(protected_areas)[1] == without_id
    assert [c.get("id") for c in stored(protected_areas)] == ["protected_areas", None]
    layer = next(
        entry
        for entry in client.get("/admin/layers", headers=admin_headers).json()
        if entry["id"] == 6
    )
    assert layer["category_issue"] is None


def test_a_rejected_entry_with_published_layers_isnt_repaired(
    protected_areas, client, admin_headers
):
    write_categories(protected_areas, [category("protected_areas", color="blue")])

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(6)" in response.json()["detail"]
    assert stored(protected_areas)[0]["color"] == "blue"


def test_a_repair_cant_change_temporal_under_its_layers(
    protected_areas, client, admin_headers
):
    # Regression (review of #138): repairing a rejected entry skipped the
    # `temporal` rule, and the hidden layer 6 (no years) could then be published
    # in a temporal category.
    client.patch("/admin/layers/6", json={"enabled": False}, headers=admin_headers)
    rejected = category("protected_areas", icon="river")  # from a later release
    write_categories(protected_areas, [rejected])

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(temporal=True),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(6)" in response.json()["detail"]
    assert stored(protected_areas) == [rejected]
    published = client.patch(
        "/admin/layers/6", json={"enabled": True}, headers=admin_headers
    )
    assert published.status_code == 400
    assert all(m["id"] != 6 for m in client.get("/maps?country=CO").json())


def test_a_repaired_deforestation_cant_drop_the_years_of_its_layers(
    colombia_layers, client, admin_headers
):
    colombia_layers.write_index([{**GFW, "enabled": False}, HIDDEN])
    write_categories(colombia_layers, [category("deforestation", icon="river")])

    response = client.put(
        "/admin/categories/deforestation",
        json=category_body(temporal=False),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(0, 5)" in response.json()["detail"]


def test_a_repair_needs_both_years_on_a_temporal_category(
    colombia_layers, client, admin_headers
):
    colombia_layers.write_index(
        [{**GFW, "enabled": False, "compared_against": None}, HIDDEN]
    )
    write_categories(colombia_layers, [category("deforestation", icon="river")])

    response = client.put(
        "/admin/categories/deforestation",
        json=category_body(temporal=True),
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(0)" in response.json()["detail"]


def test_a_repair_that_fits_the_years_succeeds(protected_areas, client, admin_headers):
    client.patch("/admin/layers/6", json={"enabled": False}, headers=admin_headers)
    write_categories(protected_areas, [category("protected_areas", icon="river")])

    response = client.put(
        "/admin/categories/protected_areas",
        json=category_body(temporal=False),
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert stored(protected_areas)[0]["icon"] == "shield"


def test_a_repair_keeps_the_entry_disabled(colombia_layers, client, admin_headers):
    # Review of #138: PUT never changes `enabled`, not even when repairing.
    write_categories(
        colombia_layers, [category("frontier", icon="river", enabled=False)]
    )

    response = client.put(
        "/admin/categories/frontier", json=category_body(), headers=admin_headers
    )

    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert stored(colombia_layers)[0]["enabled"] is False
    assert "frontier" not in public_ids(client)
    assert by_id(client, admin_headers)["frontier"]["enabled"] is False


@pytest.mark.parametrize("category_id", ["snap_ec", "unknown"])
def test_editing_a_category_the_country_doesnt_have_is_404(
    protected_areas, country_root, client, admin_headers, category_id
):
    ecuador = (country_root.root / "EC" / "categories.json").read_text()

    response = client.put(
        f"/admin/categories/{category_id}",
        json=category_body(),
        headers=admin_headers,
    )

    assert response.status_code == 404
    assert (country_root.root / "EC" / "categories.json").read_text() == ecuador


# --- Enable / disable ------------------------------------------------------------


def test_a_category_with_published_layers_cant_be_disabled(
    protected_areas, client, admin_headers
):
    response = client.patch(
        "/admin/categories/protected_areas",
        json={"enabled": False},
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(6)" in response.json()["detail"]
    assert stored(protected_areas)[0]["enabled"] is True


def test_disable_and_enable_a_category_without_published_layers(
    protected_areas, client, admin_headers
):
    client.patch("/admin/layers/6", json={"enabled": False}, headers=admin_headers)

    response = client.patch(
        "/admin/categories/protected_areas",
        json={"enabled": False},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert "protected_areas" not in public_ids(client)
    assert by_id(client, admin_headers)["protected_areas"]["enabled"] is False

    response = client.patch(
        "/admin/categories/protected_areas",
        json={"enabled": True},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert "protected_areas" in public_ids(client)


@pytest.mark.parametrize("raster", ["runap.tif", None])
def test_a_category_with_published_layers_cant_be_enabled(
    protected_areas, client, admin_headers, raster
):
    # Regression (second re-review of #138): enabling the category published a
    # hand-edited layer 7 whose years don't fit (or without a raster), skipping
    # the checks of PATCH /admin/layers/{id}.
    client.patch("/admin/layers/6", json={"enabled": False}, headers=admin_headers)
    client.patch(
        "/admin/categories/protected_areas",
        json={"enabled": False},
        headers=admin_headers,
    )
    layer7 = {
        **RUNAP,
        "id": 7,
        "baseline": "2020",
        "compared_against": "2023",
        "raster_filename": raster,
    }
    protected_areas.write_index([GFW, HIDDEN, {**RUNAP, "enabled": False}, layer7])

    response = client.patch(
        "/admin/categories/protected_areas",
        json={"enabled": True},
        headers=admin_headers,
    )

    assert response.status_code == 400
    assert "(7)" in response.json()["detail"]
    assert stored(protected_areas)[0]["enabled"] is False
    assert all(m["id"] != 7 for m in client.get("/maps?country=CO").json())


def test_disabling_the_built_in_category_stores_it_first(
    protected_areas, client, admin_headers
):
    protected_areas.write_index([{**GFW, "enabled": False}, HIDDEN, RUNAP])

    response = client.patch(
        "/admin/categories/deforestation",
        json={"enabled": False},
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert [(c["id"], c["enabled"]) for c in stored(protected_areas)] == [
        ("deforestation", False),
        ("protected_areas", True),
    ]
    assert public_ids(client) == ["protected_areas"]


def test_a_rejected_entry_cant_be_enabled_or_disabled(
    colombia_layers, client, admin_headers
):
    write_categories(colombia_layers, [category("frontier", polarity="inside")])

    response = client.patch(
        "/admin/categories/frontier", json={"enabled": False}, headers=admin_headers
    )

    assert response.status_code == 400
    assert "PUT" in response.json()["detail"]


def test_another_countrys_category_cant_be_disabled(
    protected_areas, country_root, client
):
    response = client.patch(
        "/admin/categories/protected_areas",
        json={"enabled": False},
        headers=ecuador_headers(client),
    )

    assert response.status_code == 404
    assert stored(protected_areas)[0]["enabled"] is True


# --- Unreadable file -------------------------------------------------------------


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("post", "/admin/categories", category_body("Frontier")),
        ("put", "/admin/categories/deforestation", category_body()),
        ("patch", "/admin/categories/deforestation", {"enabled": False}),
    ],
)
def test_an_unreadable_file_is_never_overwritten(
    colombia_layers, client, admin_headers, method, path, body
):
    write_categories(colombia_layers, "{ not json")

    response = getattr(client, method)(path, json=body, headers=admin_headers)

    assert response.status_code == 409
    assert "fixed on the share" in response.json()["detail"]
    assert (colombia_layers.root / "categories.json").read_text() == "{ not json"


# --- Acceptance: a country creates its own categories -----------------------------


def test_colombia_creates_protected_areas_and_agricultural_frontier(
    colombia_layers, client, admin_headers
):
    for body in (
        category_body("Protected areas"),
        category_body(
            name={"es": "Frontera agrícola", "en": "Agricultural frontier"},
            icon="agriculture",
            polarity="required",
            thresholdPercentage=0,
        ),
    ):
        response = client.post("/admin/categories", json=body, headers=admin_headers)
        assert response.status_code == 201

    for category_id, raster in (
        ("protected_areas", "runap"),
        ("frontera_agricola", "upra"),
    ):
        created = client.post(
            "/admin/layers",
            json=layer_body(
                category_id=category_id, baseline=None, compared_against=None
            ),
            headers=admin_headers,
        )
        assert created.status_code == 201
        layer = created.json()
        assert layer["category_id"] == category_id
        assert layer["baseline"] is None
        # Stands for a raster upload (tested in test_ingestion.py).
        index = json.loads(colombia_layers.store.index_path.read_text())
        for entry in index:
            if entry["id"] == layer["id"]:
                entry["raster_filename"] = f"{raster}.tif"
        colombia_layers.write_index(index)
        colombia_layers.write_raster(f"{raster}.tif")
        published = client.patch(
            f"/admin/layers/{layer['id']}",
            json={"enabled": True},
            headers=admin_headers,
        )
        assert published.status_code == 200

    public = {c["id"]: c for c in client.get("/categories?country=CO").json()}
    assert public["protected_areas"]["polarity"] == "avoid"
    assert public["frontera_agricola"]["polarity"] == "required"
    assert public["frontera_agricola"]["thresholdPercentage"] == 0
    maps = client.get("/maps?country=CO").json()
    assert {m["categoryId"] for m in maps} == {
        "deforestation",
        "protected_areas",
        "frontera_agricola",
    }

    assert set(by_id(client, ecuador_headers(client))) == {"deforestation", "snap_ec"}
    assert "protected_areas" not in public_ids(client, "EC")
    ecuador_maps = client.get("/maps?country=EC").json()
    assert [(m["id"], m["categoryId"]) for m in ecuador_maps] == [(0, "snap_ec")]
