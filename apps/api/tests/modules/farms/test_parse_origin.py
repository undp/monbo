"""`/farms/parse` echoes each farm's origin, so the web can show where it came
from after the validation without joining by position or by a made-up ID."""

from typing import Any

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def farm(farm_id: str | None, **extra: Any) -> dict[str, Any]:
    return {
        "id": farm_id,
        "producerName": "Ana",
        "productionDate": "2024-01-01",
        "productionQuantity": 10,
        "productionQuantityUnit": "kg",
        "country": "CO",
        "coordinatesFormat": "WKT",
        "geometryType": "Polygon",
        "farmCoordinates": "POLYGON ((-75 4, -75 4.001, -74.999 4.001, -75 4))",
        "cropType": "cacao",
        "documents": [],
        **extra,
    }


def parse(body: list[dict[str, Any]]) -> Any:
    return client.post("/farms/parse?locale=en", json=body)


def test_each_farm_gets_its_origin_back() -> None:
    response = parse(
        [
            farm("F1", origin={"method": "geoFile", "fileName": "fincas.kml"}),
            farm("F2", origin={"method": "manual", "fileName": None}),
            farm(
                "F3",
                origin={"method": "geoFileWithExcel", "fileName": "lotes.kmz"},
            ),
        ]
    )

    assert response.status_code == 200, response.text
    assert [f["origin"] for f in response.json()] == [
        {"method": "geoFile", "fileName": "fincas.kml"},
        {"method": "manual", "fileName": None},
        {"method": "geoFileWithExcel", "fileName": "lotes.kmz"},
    ]


def test_a_farm_without_origin_gets_null() -> None:
    response = parse([farm("F1")])

    assert response.status_code == 200, response.text
    assert response.json()[0]["origin"] is None


def test_a_file_name_over_255_characters_is_rejected() -> None:
    response = parse(
        [farm("F1", origin={"method": "excel", "fileName": "a" * 256 + ".xlsx"})]
    )

    assert response.status_code == 422


def test_an_unknown_method_is_rejected() -> None:
    response = parse([farm("F1", origin={"method": "email", "fileName": None})])

    assert response.status_code == 422
