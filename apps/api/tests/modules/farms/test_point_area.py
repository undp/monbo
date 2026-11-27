"""A point without an area is analysed as 4 ha, and `/farms/parse` says so."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

POINT = "POINT (-75 4)"
POLYGON = "POLYGON ((-75 4, -75 4.001, -74.999 4.001, -75 4))"


def farm(geometry_type: str, coordinates: str, **extra: Any) -> dict[str, Any]:
    return {
        "id": "F1",
        "producerName": "Ana",
        "productionDate": "2024-01-01",
        "productionQuantity": 10,
        "productionQuantityUnit": "kg",
        "country": "CO",
        "coordinatesFormat": "WKT",
        "geometryType": geometry_type,
        "farmCoordinates": coordinates,
        "cropType": "cacao",
        "documents": [],
        **extra,
    }


def parse_polygon(body: dict[str, Any], locale: str = "en") -> dict[str, Any]:
    response = client.post(f"/farms/parse?locale={locale}", json=[body])
    assert response.status_code == 200
    return response.json()[0]["polygon"]


def test_point_without_area_is_assumed_4_ha() -> None:
    polygon = parse_polygon(farm("Point", POINT))

    assert polygon["area"] == 40000.0
    assert polygon["details"]["radius"] == 112.84
    assert polygon["areaAssumed"] is True


@pytest.mark.parametrize("area", [None, "", 0, "0", "0,0"])
def test_point_with_blank_or_zero_area_is_assumed_4_ha(area: Any) -> None:
    polygon = parse_polygon(farm("Point", POINT, area=area), locale="es")

    assert polygon["area"] == 40000.0
    assert polygon["details"]["radius"] == 112.84
    assert polygon["areaAssumed"] is True


def test_point_with_declared_area_keeps_it() -> None:
    polygon = parse_polygon(farm("Point", POINT, area=2.5))

    assert polygon["area"] == 25000.0
    assert polygon["areaAssumed"] is False


def test_polygon_has_no_assumed_area_mark() -> None:
    polygon = parse_polygon(farm("Polygon", POLYGON, area=0))

    assert "areaAssumed" not in polygon
