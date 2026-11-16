"""Layer categories: the per-country `categories.json`, the built-in `deforestation`
category, how each layer's `category_id` resolves (and what happens when it
doesn't), and the public `GET /categories`, `GET /maps` and `GET /countries`."""

import builtins
import json
import logging
import os

import pytest
from fastapi.testclient import TestClient

from app.config import env
from app.main import create_app
from app.modules.layers.categories import (
    DEFAULT_CATEGORY,
    CategoriesFile,
    effective_categories,
    parse_categories,
)
from app.modules.maps.helpers import get_map_by_id
from tests.modules.layers.test_countries_layout import layer


def category(category_id, **overrides):
    return {
        "id": category_id,
        "name": {"es": f"{category_id} es", "en": f"{category_id} en"},
        "description": {"es": "", "en": ""},
        "icon": "shield",
        "color": "#1565c0",
        "polarity": "avoid",
        "threshold_percentage": 0,
        "result_labels": {
            "ok": {"es": "Fuera", "en": "Outside"},
            "flagged": {"es": "Dentro", "en": "Inside"},
        },
        "temporal": False,
        "enabled": True,
        **overrides,
    }


def write_categories(root, code, content):
    path = root.root / code / "categories.json"
    path.write_text(content if isinstance(content, str) else json.dumps(content))
    # Stands for a hand edit (the API writes through `LayerStore.write_categories`,
    # which refreshes its cache). The cache key is (mtime, size): make sure a rewrite
    # in the same tick is seen.
    stat = path.stat()
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))


@pytest.fixture
def co(country_root):
    """CO with a deforestation layer (no category_id) and a protected-areas layer;
    EC with a layer of its own category."""
    country_root.register("CO", "EC")
    country_root.country("CO").write_index(
        [
            layer(0, "gfw.tif"),
            layer(1, "runap.tif", category_id="protected_areas", baseline=None),
        ]
    )
    write_categories(country_root, "CO", [category("protected_areas")])
    country_root.country("EC").write_index([layer(0, "snap.tif", category_id="snap")])
    write_categories(country_root, "EC", [category("snap")])
    return country_root


def client():
    return TestClient(create_app())


def listed(code):
    response = client().get(f"/maps?country={code}")
    assert response.status_code == 200
    return {entry["id"]: entry["categoryId"] for entry in response.json()}


def category_ids(code):
    response = client().get(f"/categories?country={code}")
    assert response.status_code == 200
    return [entry["id"] for entry in response.json()]


def tags(root, code):
    return {
        entry["id"]: entry["category_issue"]
        for entry in root.layers_root.country_layers(code)
    }


# --- Parsing ---------------------------------------------------------------------


def test_a_missing_file_gives_the_built_in_category():
    assert effective_categories(CategoriesFile()) == [DEFAULT_CATEGORY]
    assert DEFAULT_CATEGORY["polarity"] == "avoid"
    assert DEFAULT_CATEGORY["temporal"] is True
    assert DEFAULT_CATEGORY["threshold_percentage"] is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"polarity": "inside"},
        {"threshold_percentage": 120},
        {"threshold_percentage": -1},
        {"threshold_percentage": "5"},
        {"icon": "tree"},
        {"color": "red"},
        {"id": "Protected Areas"},
        {"temporal": "yes"},
        {"result_labels": {"ok": {"es": "Fuera", "en": "Outside"}}},
        {"name": {"es": "", "en": "Areas"}},
    ],
)
def test_an_invalid_category_is_rejected_alone(overrides):
    file = parse_categories(
        [category("frontier"), category("protected_areas", **overrides)]
    )

    assert file.readable
    assert [c["id"] for c in file.categories] == ["frontier"]
    assert len(file.errors) == 1
    assert file.errors[0].startswith("entry 1")


def test_threshold_bounds_are_inclusive():
    file = parse_categories(
        [
            category("a", threshold_percentage=0),
            category("b", threshold_percentage=100),
            category("c", threshold_percentage=None),
        ]
    )
    assert file.errors == []
    assert [c["threshold_percentage"] for c in file.categories] == [0, 100, None]


def test_a_repeated_id_rejects_every_copy():
    file = parse_categories(
        [category("frontier"), category("frontier", polarity="required")]
    )

    assert file.categories == []
    assert file.invalid_ids == {"frontier"}
    assert len(file.errors) == 2


def test_a_file_that_is_not_a_list_is_unreadable():
    assert not parse_categories({"categories": []}).readable
    assert not parse_categories(None).readable


def test_unknown_fields_are_ignored():
    # A file written by a later release still loads.
    file = parse_categories([category("frontier", order=3)])
    assert file.errors == []
    assert "order" not in file.categories[0]


# --- Store -----------------------------------------------------------------------


def test_layers_resolve_their_category(co):
    layers = co.layers_root.country_layers("CO")

    assert [
        (e["category_id"], e["category_issue"], e["category_enabled"]) for e in layers
    ] == [
        ("deforestation", None, True),
        ("protected_areas", None, True),
    ]


def test_a_stored_deforestation_category_wins(co):
    write_categories(
        co, "CO", [category("deforestation", threshold_percentage=5, temporal=True)]
    )

    response = client().get("/categories?country=CO").json()
    assert [(c["id"], c["thresholdPercentage"]) for c in response] == [
        ("deforestation", 5)
    ]


def test_an_unknown_category_hides_only_that_layer(co, caplog):
    co.country("CO").write_index(
        [layer(0, "gfw.tif"), layer(3, "x.tif", category_id="frontier")]
    )

    with caplog.at_level(logging.ERROR):
        assert listed("CO") == {0: "deforestation"}
    assert tags(co, "CO") == {0: None, 3: "unknown_category"}
    assert "Layer 3 of CO" in caplog.text and "'frontier'" in caplog.text
    # Still resolvable by id for an analysis or a tile that already uses it.
    assert get_map_by_id(3, "CO")["category_issue"] == "unknown_category"


def test_an_invalid_category_hides_its_layers(co, caplog):
    with caplog.at_level(logging.ERROR):
        write_categories(co, "CO", [category("protected_areas", polarity="inside")])
        assert listed("CO") == {0: "deforestation"}

    assert tags(co, "CO") == {0: None, 1: "invalid_category"}
    assert category_ids("CO") == ["deforestation"]
    assert "categories.json" in caplog.text and "polarity" in caplog.text
    # Other countries are unaffected.
    assert listed("EC") == {0: "snap"}


def test_an_invalid_stored_deforestation_is_not_replaced_by_the_built_in(co):
    write_categories(
        co,
        "CO",
        [
            category("deforestation", threshold_percentage=150),
            category("protected_areas"),
        ],
    )

    assert tags(co, "CO") == {0: "invalid_category", 1: None}
    assert category_ids("CO") == ["protected_areas"]
    assert listed("CO") == {1: "protected_areas"}


def test_an_unparseable_file_resolves_nothing(co):
    write_categories(co, "CO", "{ not json")

    assert tags(co, "CO") == {0: "unreadable_categories", 1: "unreadable_categories"}
    assert listed("CO") == {}
    assert category_ids("CO") == []
    assert listed("EC") == {0: "snap"}


def test_tags_are_never_written_back(co):
    store = co.store("CO")
    with store.locked():
        store.write_index(store.read_index())

    on_disk = json.loads((co.root / "CO" / "index.json").read_text())
    assert all(
        "category_issue" not in e and "category_enabled" not in e for e in on_disk
    )
    assert [e["category_id"] for e in on_disk] == ["deforestation", "protected_areas"]


def test_the_cache_sees_a_rewritten_file(co):
    assert category_ids("CO") == ["deforestation", "protected_areas"]
    write_categories(co, "CO", [category("protected_areas"), category("frontier")])
    assert category_ids("CO") == ["deforestation", "protected_areas", "frontier"]


def test_a_transient_read_error_is_not_cached(co, monkeypatch, caplog):
    # Regression: an OSError while opening the file was cached as "unreadable" and
    # hid the whole country until the file changed or the API restarted.
    path = str(co.root / "CO" / "categories.json")
    real_open = builtins.open
    failures = []

    def flaky_open(file, *args, **kwargs):
        if str(file) == path and not failures:
            failures.append(file)
            raise OSError(5, "Input/output error")
        return real_open(file, *args, **kwargs)

    store = co.store("CO")
    monkeypatch.setattr(builtins, "open", flaky_open)
    with caplog.at_level(logging.ERROR):
        assert store.read_categories().readable is False
        assert store.read_categories().readable is True

    assert "Cannot read categories" in caplog.text
    assert "not a JSON list" not in caplog.text
    assert listed("CO") == {0: "deforestation", 1: "protected_areas"}


def test_invalid_json_is_reported_as_such(co, caplog):
    with caplog.at_level(logging.ERROR):
        write_categories(co, "CO", "{ not json")
        assert co.store("CO").read_categories().readable is False

    assert "is not valid JSON" in caplog.text


def test_a_persistent_read_error_is_logged_once(co, caplog):
    path = co.root / "CO" / "categories.json"
    path.unlink()
    path.mkdir()  # stat works, open fails every time

    with caplog.at_level(logging.ERROR):
        for _ in range(3):
            assert co.store("CO").read_categories().readable is False

    assert caplog.text.count("Cannot read categories") == 1


def test_write_categories_refreshes_the_cache(co):
    # A rewrite in the same mtime tick with the same size must not be read back
    # from the cache: write, read (caching it), rewrite, and put the first mtime
    # back, as if both writes had happened in the same tick.
    store = co.store("CO")
    path = co.root / "CO" / "categories.json"
    store.write_categories([category("protected_areas", color="#111111")])
    assert store.read_categories().categories[0]["color"] == "#111111"
    first = path.stat()

    store.write_categories([category("protected_areas", color="#222222")])
    os.utime(path, ns=(first.st_atime_ns, first.st_mtime_ns))

    assert path.stat().st_size == first.st_size
    assert store.read_categories().categories[0]["color"] == "#222222"


def test_write_categories_refuses_invalid_lists(co):
    store = co.store("CO")
    with pytest.raises(ValueError):
        store.write_categories([category("a"), category("a")])

    store.write_categories([category("frontier", polarity="required")])
    assert [c["id"] for c in store.read_categories().categories] == ["frontier"]


def test_the_flat_layout_has_only_the_built_in_category(maps_root):
    maps_root.write_index(
        [
            layer(0, "gfw.tif", available_countries_codes=["CO"]),
            layer(1, "x.tif", available_countries_codes=["CO"], category_id="frontier"),
        ]
    )

    assert {e["id"]: e["category_issue"] for e in maps_root.layers_root.layers()} == {
        0: None,
        1: "unknown_category",
    }
    assert listed("CO") == {0: "deforestation"}
    assert category_ids("CO") == ["deforestation"]
    assert category_ids("EC") == []


def test_the_git_tracked_layers_are_all_deforestation():
    # MAPS_ROOT unset: the flat app/maps root.
    for code in ("CO", "CR", "EC"):
        assert set(listed(code).values()) == {"deforestation"}
        assert category_ids(code) == ["deforestation"]


# --- GET /categories ---------------------------------------------------------------


def test_categories_of_a_country(co, monkeypatch):
    monkeypatch.setattr(env, "DEFORESTATION_THRESHOLD_PERCENTAGE", 10.0)
    write_categories(
        co,
        "CO",
        [
            category("protected_areas", threshold_percentage=0),
            category("frontier", polarity="required", enabled=False),
        ],
    )

    response = client().get("/categories?country=CO")

    assert response.status_code == 200
    deforestation, protected_areas = response.json()
    assert deforestation == {
        "id": "deforestation",
        "name": {"es": "Deforestación", "en": "Deforestation"},
        "description": {
            "es": "Pérdida de bosque posterior al año de línea base de la capa.",
            "en": "Forest loss after the layer's baseline year.",
        },
        "icon": "forest",
        "color": "#c62828",
        "polarity": "avoid",
        "thresholdPercentage": 10.0,
        "resultLabels": {
            "ok": {"es": "Libre de deforestación", "en": "Deforestation-free"},
            "flagged": {"es": "Con deforestación", "en": "With deforestation"},
        },
        "temporal": True,
    }
    assert protected_areas["id"] == "protected_areas"
    assert protected_areas["thresholdPercentage"] == 0


def test_categories_never_show_another_countrys(co):
    assert "snap" not in category_ids("CO")
    assert "protected_areas" not in category_ids("EC")


def test_categories_of_unknown_or_disabled_countries_are_empty(co):
    assert category_ids("PE") == []
    registry = co.layers_root.read_registry()
    for country in registry:
        country["enabled"] = country["code"] != "EC"
    co.write_registry(registry)

    assert category_ids("EC") == []


@pytest.mark.parametrize("query", ["", "?country=co", "?country=COL"])
def test_categories_need_a_valid_country(co, query):
    assert client().get(f"/categories{query}").status_code == 422


def test_categories_answer_500_when_the_index_is_unreadable(co):
    (co.root / "CO" / "index.json").write_text("{ broken")
    assert client().get("/categories?country=CO").status_code == 500


# --- GET /maps and GET /countries ----------------------------------------------------


def test_a_layer_of_a_disabled_category_is_not_listed(co):
    write_categories(co, "CO", [category("protected_areas", enabled=False)])

    assert listed("CO") == {0: "deforestation"}
    assert get_map_by_id(1, "CO")["category_enabled"] is False


def test_layers_without_years_list_null(co):
    co.country("CO").write_index(
        [
            {
                key: value
                for key, value in layer(
                    1, "runap.tif", category_id="protected_areas", baseline=None
                ).items()
                if key != "compared_against"
            }
        ]
    )

    (entry,) = client().get("/maps?country=CO").json()
    assert entry["baseline"] is None
    assert entry["comparedAgainst"] is None


def test_a_country_with_only_broken_categories_is_not_offered(co):
    write_categories(co, "EC", [category("snap", enabled=False)])
    assert [c["code"] for c in client().get("/countries").json()] == ["CO"]

    write_categories(co, "EC", "{ not json")
    assert [c["code"] for c in client().get("/countries").json()] == ["CO"]


def test_an_analysis_still_resolves_a_hidden_layer(co):
    write_categories(co, "CO", [category("protected_areas", enabled=False)])

    response = client().post(
        "/layer_analysis/analyze",
        json={"country": "CO", "maps": [1], "farms": []},
    )
    assert response.status_code == 200
    assert [result["mapId"] for result in response.json()] == [1]
