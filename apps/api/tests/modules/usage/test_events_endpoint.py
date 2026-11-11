"""`POST /events`: public, closed schema, capped (spec "Public events endpoint with a
closed schema")."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.modules.usage.conftest import recorded

SESSION = "3f1c2b8e-1d2a-4c5b-9e7f-0a1b2c3d4e5f"


@pytest.fixture
def client(usage_dir, maps_root):
    return TestClient(create_app())


def test_valid_event(client, usage_dir):
    body = {
        "type": "report_downloaded",
        "outcome": "ok",
        "format": "zip",
        "farms": 12,
        "country": "PE",
        "session": SESSION,
    }
    response = client.post("/events", json=body)
    assert response.status_code == 204
    assert response.content == b""

    [event] = recorded(usage_dir)
    assert event["source"] == "browser"
    assert event["type"] == "report_downloaded"
    assert (event["format"], event["farms"], event["country"]) == ("zip", 12, "PE")
    assert event["session"] == SESSION
    assert event["at"].endswith("Z")


def test_report_requested(client, usage_dir):
    response = client.post(
        "/events", json={"type": "report_requested", "outcome": "ok", "farms": 5}
    )
    assert response.status_code == 204
    [event] = recorded(usage_dir)
    assert event["type"] == "report_requested" and event["farms"] == 5
    assert "format" not in event


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({"type": "page_view"}, id="unknown type"),
        pytest.param(
            {"type": "upload", "outcome": "ok", "farms": 1}, id="server event type"
        ),
        pytest.param(
            {
                "type": "report_requested",
                "outcome": "ok",
                "farms": 1,
                "at": "2020-01-01T00:00:00Z",
            },
            id="client time",
        ),
        pytest.param(
            {"type": "report_downloaded", "outcome": "ok", "farms": 1},
            id="missing format",
        ),
        pytest.param(
            {"type": "report_requested", "outcome": "ok", "farms": 1, "format": "pdf"},
            id="format on report_requested",
        ),
        pytest.param(
            {"type": "report_requested", "outcome": "ok", "farms": 100_001},
            id="too many farms",
        ),
        pytest.param(
            {"type": "report_requested", "outcome": "ok", "farms": -1},
            id="negative farms",
        ),
        pytest.param(
            {"type": "report_requested", "outcome": "ok", "farms": 1, "session": "x"},
            id="invalid session",
        ),
    ],
)
def test_rejected_event(client, usage_dir, body):
    assert client.post("/events", json=body).status_code == 422
    assert recorded(usage_dir) == []


def test_oversized_body(client, usage_dir):
    body = json.dumps(
        {"type": "report_requested", "outcome": "ok", "farms": 1, "pad": "x" * 10_000}
    )
    response = client.post(
        "/events", content=body, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert recorded(usage_dir) == []


def test_oversized_body_without_content_length(client, usage_dir):
    def chunks():
        yield b'{"type":"report_requested","outcome":"ok","farms":1,"pad":"'
        for _ in range(10):
            yield b"x" * 1000
        yield b'"}'

    response = client.post(
        "/events", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert recorded(usage_dir) == []


def test_no_origin_check(client, usage_dir, monkeypatch):
    from app.config import env

    monkeypatch.setattr(env, "ADMIN_ALLOWED_ORIGIN", "https://monbo.example.org")
    response = client.post(
        "/events",
        json={"type": "report_requested", "outcome": "ok", "farms": 1},
        headers={"Origin": "https://elsewhere.example.org"},
    )
    assert response.status_code == 204
