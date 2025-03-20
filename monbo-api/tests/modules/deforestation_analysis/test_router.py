from app.main import app
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from PIL import Image

client = TestClient(app)


@patch("app.modules.deforestation_analysis.router.get_all_maps")
def test_get_maps(mock_get_all_maps):
    mock_data = [
        {"id": 1, "name": "Map A", "alias": "Alpha"},
        {"id": 2, "name": "Map B", "alias": "Bravo"},
    ]
    mock_get_all_maps.return_value = mock_data

    response = client.get("/deforestation_analysis/get-maps")
    assert response.status_code == 200
    assert response.json() == mock_data


@patch("app.modules.deforestation_analysis.router.get_map_by_id")
def test_get_map_data(mock_get_map_by_id):
    mock_get_map_by_id.return_value = {"id": 1, "name": "Map A", "alias": "Alpha"}
    response = client.get("/deforestation_analysis/get-maps/1")
    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Map A", "alias": "Alpha"}

    mock_get_map_by_id.return_value = None
    response = client.get("/deforestation_analysis/get-maps/3")  # ID not in mock data
    assert response.status_code == 404
    assert response.json() == {"detail": "Map not found"}


def test_parse_farms():
    request_data = [
        {
            "id": "farm_001",
            "producerName": "John Doe",
            "productionDate": "2024-01-01",
            "productionQuantity": 500.0,
            "productionQuantityUnit": "kg",
            "country": "Brazil",
            "region": "Amazon",
            "farmCoordinates": "[(-50.456, 10.123)]",
            "cropType": "Soy",
            "association": "GreenFarmers",
        },
    ]

    expected_response = [
        {
            "id": "farm_001",
            "producer": "John Doe",
            "producerId": "",
            "cropType": "Soy",
            "productionDate": "2024-01-01",
            "production": 500.0,
            "productionQuantityUnit": "kg",
            "country": "Brazil",
            "region": "Amazon",
            "association": "GreenFarmers",
            "polygon": {
                "type": "point",
                "details": {"center": {"lat": 10.123, "lng": -50.456}, "radius": 100.0},
                "area": 30798.39,
            },
        }
    ]

    response = client.post("/deforestation_analysis/parse-farms", json=request_data)

    assert response.status_code == 200
    assert response.json() == expected_response


@patch("app.modules.deforestation_analysis.router.rasterio.open")
@patch("app.modules.deforestation_analysis.router.get_all_maps")
@patch("app.modules.deforestation_analysis.router.get_map_pixels_inside_polygon")
@patch("app.modules.deforestation_analysis.router.get_pixel_area")
@patch("app.modules.deforestation_analysis.router.get_deforestation_percentage")
def test_analize(
    mock_get_deforestation_percentage,
    mock_get_pixel_area,
    mock_get_map_pixels_inside_polygon,
    mock_get_all_maps,
    mock_raster_open,
):
    mock_dataset = MagicMock()
    mock_dataset.crs = "EPSG:4326"
    mock_dataset.count = 1  # Simulate a single-band raster
    mock_dataset.width = 100  # Ensure width is an integer
    mock_dataset.height = 100  # Ensure height is an integer
    mock_raster_open.return_value.__enter__.return_value = mock_dataset

    # Mock map data
    mock_get_all_maps.return_value = [
        {
            "id": 1,
            "name": "Deforestation Map A",
            "asset": {"name": "deforestation_map_a"},
        },
        {
            "id": 2,
            "name": "Deforestation Map B",
            "asset": {"name": "deforestation_map_b"},
        },
    ]

    # Mock function behavior
    mock_get_map_pixels_inside_polygon.return_value = [
        2020,
        2021,
    ]  # Example years of deforestation
    mock_get_pixel_area.return_value = 10.0  # Example pixel area
    mock_get_deforestation_percentage.return_value = (
        15.5  # Example deforested percentage
    )

    # Define test request payload
    request_data = {
        "maps": [1],
        "farms": [
            {
                "id": "farm_001",
                "type": "point",
                "center": {
                    "lat": 10.123,
                    "lng": -50.456,
                },
            }
        ],
    }

    # Define expected response
    expected_response = [
        {
            "mapId": 1,
            "farmResults": [
                {
                    "farmId": "farm_001",
                    "value": 15.5,
                }
            ],
        }
    ]

    # Make the request
    response = client.post("/deforestation_analysis/analize", json=request_data)

    # Assertions
    assert response.status_code == 200
    assert response.json() == expected_response

    def raise_exception(*args, **kwargs):
        raise Exception("Error")

    mock_raster_open.side_effect = raise_exception
    response = client.post("/deforestation_analysis/analize", json=request_data)
    assert response.status_code == 200
    assert response.json() == [
        {"mapId": 1, "farmResults": [{"farmId": "farm_001", "value": None}]}
    ]


@patch("app.modules.deforestation_analysis.router.get_map_by_id")
@patch("app.modules.deforestation_analysis.router.get_tile")
def test_serve_tile(mock_get_tile, mock_get_map_by_id):
    mock_get_map_by_id.return_value = None
    response = client.get("/deforestation_analysis/tiles/1/dynamic/0/0/0.png")
    assert response.status_code == 404
    assert response.json() == {"detail": "Map not found"}

    mock_get_map_by_id.return_value = {
        "id": 1,
        "name": "Deforestation Map A",
        "asset": {"name": "deforestation_map_a", "deforestation_values": [2020, 2021]},
    }
    mock_get_tile.side_effect = lambda a, b, c, d, e: Image.new(
        "RGBA", (256, 256), (0, 0, 0, 0)
    )
    response = client.get("/deforestation_analysis/tiles/1/dynamic/0/0/0.png")
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/png"

    def raise_exception(*args, **kwargs):
        raise Exception("Error")

    mock_get_tile.side_effect = raise_exception
    response = client.get("/deforestation_analysis/tiles/1/dynamic/0/0/0.png")
    assert response.status_code == 404
    assert response.json() == {"detail": "Tile not found"}
