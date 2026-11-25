import pytest
from fastapi.testclient import TestClient

from app.config import env
from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())


def test_config_publishes_both_thresholds(client, monkeypatch):
    monkeypatch.setattr(env, "OVERLAP_THRESHOLD_PERCENTAGE", 1.0)
    monkeypatch.setattr(env, "DEFORESTATION_THRESHOLD_PERCENTAGE", 2.0)

    response = client.get("/config")

    assert response.status_code == 200
    assert response.json() == {
        "overlapThresholdPercentage": 1.0,
        "deforestationThresholdPercentage": 2.0,
    }


def test_config_defaults_to_zero(client, monkeypatch):
    monkeypatch.setattr(env, "OVERLAP_THRESHOLD_PERCENTAGE", 0)
    monkeypatch.setattr(env, "DEFORESTATION_THRESHOLD_PERCENTAGE", 0)

    assert client.get("/config").json() == {
        "overlapThresholdPercentage": 0,
        "deforestationThresholdPercentage": 0,
    }


@pytest.mark.parametrize(
    "raw, expected",
    [(None, 0), ("", 0), ("0", 0.0), ("2", 2.0), ("2.5", 2.5), ("100", 100.0)],
)
def test_percentage_setting(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv("SOME_THRESHOLD", raising=False)
    else:
        monkeypatch.setenv("SOME_THRESHOLD", raw)
    assert env._percentage("SOME_THRESHOLD") == expected


@pytest.mark.parametrize(
    "raw, message",
    [
        ("150", "SOME_THRESHOLD must be between 0 and 100, got 150.0"),
        ("-1", "SOME_THRESHOLD must be between 0 and 100, got -1.0"),
        ("abc", "SOME_THRESHOLD must be a valid number, got 'abc'"),
    ],
)
def test_invalid_percentage_setting(monkeypatch, raw, message):
    monkeypatch.setenv("SOME_THRESHOLD", raw)
    with pytest.raises(
        ValueError, match=message.replace("(", r"\(").replace(".", r"\.")
    ):
        env._percentage("SOME_THRESHOLD")
