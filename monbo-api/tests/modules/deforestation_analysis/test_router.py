from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from PIL import Image

from app.config.constants import FarmDefaults
from app.main import app
from app.utils.polygons import get_point_area_and_radius

client = TestClient(app)


# get_all_maps returns raw index entries; the router enriches each one with the
# attributes/considerations metadata files (read_attributes / read_considerations)
# and maps them onto the BaseMapData response schema.
MAPS_MOCK_DATA = [
    {
        "id": 0,
        "attributes_filename": "gfw.json",
        "considerations_filename": "gfw.md",
        "baseline": "2020",
        "compared_against": "2023",
        "references": [
            "https://glad.earthengine.app/view/global-forest-change#bl=off;"
            "old=off;dl=1;lon=20;lat=10;zoom=3;"
        ],
        "available_countries_codes": ["EC", "CO", "CR"],
    }
]

ATTRIBUTES_MOCK_DATA = {
    "name": "Global Forest Watch",
    "alias": "GFW 2020-2023",
    "coverage": (
        "Superficie terrestre global (excluyendo la Antártida y otras "
        "islas del Ártico)"
    ),
    "source": (
        "https://glad.earthengine.app/view/global-forest-change#bl=off;"
        "old=off;dl=1;lon=20;lat=10;zoom=3;"
    ),
    "resolution": "30 x 30 metros",
    "contentDate": "Cambio forestal mundial entre 2000 y 2023",
    "updateFrequency": "Anual",
    "publishDate": "2024",
}

CONSIDERATIONS_MOCK_DATA = (
    "Definiciones y Limitaciones de los Datos\n\n  * Definición de bosque"
)

EXPECTED_MAPS_DATA = [
    {
        "id": 0,
        "name": "Global Forest Watch",
        "alias": "GFW 2020-2023",
        "baseline": 2020,
        "comparedAgainst": 2023,
        "coverage": (
            "Superficie terrestre global (excluyendo la Antártida y otras "
            "islas del Ártico)"
        ),
        "source": (
            "https://glad.earthengine.app/view/global-forest-change#bl=off;"
            "old=off;dl=1;lon=20;lat=10;zoom=3;"
        ),
        "resolution": "30 x 30 metros",
        "contentDate": "Cambio forestal mundial entre 2000 y 2023",
        "updateFrequency": "Anual",
        "publishDate": "2024",
        "references": [
            "https://glad.earthengine.app/view/global-forest-change#bl=off;"
            "old=off;dl=1;lon=20;lat=10;zoom=3;"
        ],
        "considerations": CONSIDERATIONS_MOCK_DATA,
        "availableCountriesCodes": ["EC", "CO", "CR"],
    }
]


@patch("app.modules.maps.router.read_considerations")
@patch("app.modules.maps.router.read_attributes")
@patch("app.modules.maps.router.get_all_maps")
def test_get_maps(mock_get_all_maps, mock_read_attributes, mock_read_considerations):
    mock_get_all_maps.return_value = MAPS_MOCK_DATA
    mock_read_attributes.return_value = ATTRIBUTES_MOCK_DATA
    mock_read_considerations.return_value = CONSIDERATIONS_MOCK_DATA

    response = client.get("/maps")
    assert response.status_code == 200
    json_response = response.json()
    assert json_response == EXPECTED_MAPS_DATA


def test_parse_farms():
    # The farm-parsing endpoint lives under the farms module at /farms/parse and
    # accepts the WKT/GeoJSON InputFarmData schema.
    request_data = [
        {
            "id": "farm_001",
            "producerName": "John Doe",
            "productionDate": "2024-01-01",
            "productionQuantity": 500.0,
            "productionQuantityUnit": "kg",
            "country": "BR",
            "region": "Amazon",
            "coordinatesFormat": "WKT",
            "geometryType": "Point",
            "farmCoordinates": "POINT (-50.456 10.123)",
            "cropType": "Soy",
            "association": "GreenFarmers",
            "documents": [
                {
                    "name": "Document 1",
                    "url": "https://example.com/document1.pdf",
                }
            ],
        },
    ]

    # A point without an explicit area falls back to the default point area, from
    # which the stored area (m²) and radius (m) are derived.
    expected_area, expected_radius = get_point_area_and_radius(
        FarmDefaults.DEFAULT_POINT_AREA_HECTARES
    )

    expected_response = [
        {
            "id": "farm_001",
            "producer": "John Doe",
            "producerId": "",
            "cropType": "Soy",
            "productionDate": "2024-01-01",
            "production": 500.0,
            "productionQuantityUnit": "kg",
            "country": "BR",
            "region": "Amazon",
            "association": "GreenFarmers",
            "documents": [
                {
                    "name": "Document 1",
                    "url": "https://example.com/document1.pdf",
                }
            ],
            "polygon": {
                "type": "point",
                "details": {
                    "center": {"lat": 10.123, "lng": -50.456},
                    "radius": expected_radius,
                },
                "area": expected_area,
            },
        }
    ]

    response = client.post("/farms/parse", json=request_data)

    assert response.status_code == 200
    assert response.json() == expected_response


@patch("app.modules.deforestation_analysis.router.get_map_raster_path")
@patch("app.modules.deforestation_analysis.router.rasterio_open")
@patch("app.modules.deforestation_analysis.router.get_all_maps")
@patch("app.modules.deforestation_analysis.router.get_map_pixels_inside_polygon")
@patch("app.modules.deforestation_analysis.router.get_pixel_area")
@patch("app.modules.deforestation_analysis.router.get_deforestation_ratio")
def test_analize(
    mock_get_deforestation_percentage,
    mock_get_pixel_area,
    mock_get_map_pixels_inside_polygon,
    mock_get_all_maps,
    mock_raster_open,
    mock_get_map_raster_path,
):
    mock_get_map_raster_path.return_value = "dummy/path.tif"
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
            "raster_filename": "deforestation_map_a",
        },
        {
            "id": 2,
            "name": "Deforestation Map B",
            "raster_filename": "deforestation_map_b",
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
                "details": {
                    "center": {
                        "lat": 10.123,
                        "lng": -50.456,
                    },
                    "radius": 100.0,
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


@patch("app.modules.deforestation_analysis.router.get_map_raster_path")
@patch("app.modules.deforestation_analysis.router.get_tile")
@patch("app.modules.deforestation_analysis.router.get_map_by_id")
def test_serve_tile(mock_get_map_by_id, mock_get_tile, mock_get_map_raster_path):
    mock_get_map_raster_path.return_value = "dummy/path.tif"
    mock_get_map_by_id.return_value = None
    response = client.get("/deforestation_analysis/tiles/1/dynamic/0/0/0.png")
    assert response.status_code == 404
    assert response.json() == {"detail": "Map not found"}

    mock_get_map_by_id.return_value = {
        "id": 1,
        "name": "Deforestation Map A",
        "raster_filename": "deforestation_map_a",
    }
    mock_get_tile.side_effect = lambda a, b, c, d: Image.new(
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
