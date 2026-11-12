"""One usage event per upload, validation and analysis, whatever the result (spec
"The API records an event for each upload, validation and analysis")."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.usage.tracking import outcome_for
from tests.modules.usage.conftest import recorded

SESSION = "3f1c2b8e-1d2a-4c5b-9e7f-0a1b2c3d4e5f"
HEADERS = {
    "X-Monbo-Session": SESSION,
    "X-Monbo-Country": "CR",
    "X-Monbo-Module": "deforestation-analysis",
}
# Recognizable values that must never reach an event
PRODUCER = "Productora Secreta"
FARM_ID = "finca-secreta-42"


def _input_farm(farm_id, coordinates, geometry="Point"):
    return {
        "id": farm_id,
        "producerName": PRODUCER,
        "productionDate": "2024-01-01",
        "productionQuantity": 500.0,
        "productionQuantityUnit": "kg",
        "country": "CR",
        "region": "Guanacaste",
        "coordinatesFormat": "WKT",
        "geometryType": geometry,
        "farmCoordinates": coordinates,
        "cropType": "Coffee",
        "association": "",
        "documents": [],
    }


POINT = _input_farm(FARM_ID, "POINT (-84.123 10.456)")
SQUARE = _input_farm(
    "farm-2",
    "POLYGON ((-84.1 10.1, -84.1 10.2, -84.0 10.2, -84.0 10.1, -84.1 10.1))",
    geometry="Polygon",
)


def _square(farm_id, x0, y0, size=0.01):
    ring = [
        {"lng": x0, "lat": y0},
        {"lng": x0, "lat": y0 + size},
        {"lng": x0 + size, "lat": y0 + size},
        {"lng": x0 + size, "lat": y0},
    ]
    return {
        "id": farm_id,
        "type": "polygon",
        "details": {
            "center": {"lng": x0, "lat": y0},
            "parts": [{"exterior": ring, "holes": []}],
        },
    }


@pytest.fixture
def client(usage_dir, maps_root):
    return TestClient(create_app(), raise_server_exceptions=False)


def test_successful_upload(client, usage_dir):
    response = client.post("/farms/parse", json=[POINT, SQUARE], headers=HEADERS)
    assert response.status_code == 200

    [event] = recorded(usage_dir)
    assert event["type"] == "upload" and event["outcome"] == "ok"
    assert event["source"] == "server"
    assert (event["farms"], event["polygons"], event["points"]) == (2, 1, 1)
    assert event["session"] == SESSION
    assert event["country"] == "CR"
    assert event["module"] == "deforestation-analysis"


def test_rejected_upload_has_no_counts(client, usage_dir):
    response = client.post("/farms/parse?locale=fr", json=[POINT], headers=HEADERS)
    assert response.status_code == 400

    [event] = recorded(usage_dir)
    assert event["type"] == "upload" and event["outcome"] == "invalid_input"
    assert "farms" not in event and "polygons" not in event


def test_validation_counts_the_farms_not_valid(client, usage_dir):
    farms = [
        _square("a", 0.0, 0.0),
        _square("b", 0.005, 0.005),  # overlaps a
        _square("c", 1.0, 1.0),
    ]
    response = client.post("/polygons_validation/validate", json=farms, headers=HEADERS)
    assert response.status_code == 200

    [event] = recorded(usage_dir)
    assert event["type"] == "validation" and event["outcome"] == "ok"
    assert (event["farms"], event["invalidFarms"]) == (3, 2)
    assert "module" not in event


@patch("app.modules.deforestation_analysis.router.get_country_maps", return_value=[])
def test_analysis_takes_the_body_country(_, client, usage_dir):
    body = {"country": "PE", "maps": [], "farms": [_square("a", 0.0, 0.0)]}
    response = client.post(
        "/deforestation_analysis/analize", json=body, headers=HEADERS
    )
    assert response.status_code == 200

    [event] = recorded(usage_dir)
    assert event["type"] == "analysis" and event["outcome"] == "ok"
    assert event["country"] == "PE"
    assert (event["farms"], event["maps"]) == (1, 0)


def test_a_422_before_the_route_is_invalid_input(client, usage_dir):
    response = client.post(
        "/deforestation_analysis/analize", json={"maps": "all"}, headers=HEADERS
    )
    assert response.status_code == 422

    [event] = recorded(usage_dir)
    assert event["type"] == "analysis" and event["outcome"] == "invalid_input"
    assert event["country"] == "CR"  # no body country: the header's


@patch(
    "app.modules.polygons_validation.router.get_overlap_inconsistencies",
    side_effect=RuntimeError("boom"),
)
def test_an_unhandled_exception_is_a_server_error(_, client, usage_dir):
    response = client.post(
        "/polygons_validation/validate", json=[_square("a", 0, 0)], headers=HEADERS
    )
    assert response.status_code == 500

    [event] = recorded(usage_dir)
    assert event["type"] == "validation" and event["outcome"] == "server_error"


def test_requests_without_headers(client, usage_dir):
    response = client.post("/polygons_validation/validate", json=[_square("a", 0, 0)])
    assert response.status_code == 200

    [event] = recorded(usage_dir)
    assert event["session"] is None and event["country"] is None


def test_invalid_headers_are_dropped(client, usage_dir):
    headers = {
        "X-Monbo-Session": "not-a-uuid",
        "X-Monbo-Country": "cr",
        "X-Monbo-Module": "admin",
    }
    response = client.post("/farms/parse", json=[POINT], headers=headers)
    assert response.status_code == 200

    [event] = recorded(usage_dir)
    assert event["session"] is None
    assert event["country"] is None
    assert "module" not in event


def test_other_routes_record_nothing(client, usage_dir):
    client.get("/health/live")
    client.post("/farms/import")
    assert recorded(usage_dir) == []


def test_an_event_never_contains_farm_data(client, usage_dir):
    client.post("/farms/parse", json=[POINT, SQUARE], headers=HEADERS)
    client.post(
        "/polygons_validation/validate",
        json=[_square(FARM_ID, -84.123, 10.456)],
        headers=HEADERS,
    )

    text = "\n".join(str(event) for event in recorded(usage_dir))
    for value in (FARM_ID, PRODUCER, "-84.123", "10.456", "Guanacaste", "Coffee"):
        assert value not in text


@pytest.mark.parametrize(
    "status, outcome",
    [
        (200, "ok"),
        (399, "ok"),
        (400, "invalid_input"),
        (499, "invalid_input"),
        (500, "server_error"),
        (None, "server_error"),
    ],
)
def test_outcome_from_the_status_code(status, outcome):
    assert outcome_for(status) == outcome
