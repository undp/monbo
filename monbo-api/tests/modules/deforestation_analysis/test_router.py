from unittest.mock import MagicMock, patch

from app.main import app
from fastapi.testclient import TestClient
from PIL import Image

client = TestClient(app)


MAPS_MOCK_DATA = [
    {
        "id": 0,
        "name": "Global Forest Watch",
        "alias": "GFW 2020-2023",
        "asset": {
            "name": "gfw",
            "deforestation_values": [1],
            "pixel_size": 30,
            "baseline": "2020",
            "compared_against": "2023",
            "coverage": "Superficie terrestre global (excluyendo la Antártida y otras islas del Ártico)",
            "details": "Global Forest Watch, en colaboración con Nasa, Universidad de Maryland y Google",
            "resolution": "30 x 30 metros",
            "contentDate": "Cambio forestal mundial entre 2000 y 2023",
            "updateFrequency": "Anual",
            "source": "https://glad.earthengine.app/view/global-forest-change#bl=off;old=off;dl=1;lon=20;lat=10;zoom=3;",
            "disclaimer": "Definiciones y Limitaciones de los Datos\n\n  * Definición de bosque: GFW usa la definición de la Universidad de Maryland (UMD), que considera bosques como áreas con un dosel de al menos 30% y árboles de más de 5 metros de altura. Esto puede no coincidir con definiciones legales o ecológicas en algunos países.\n* Deforestación ≠ conversión de uso de suelo: La pérdida de cobertura arbórea detectada no siempre implica conversión permanente, ya que incluye tala selectiva, incendios temporales y otros disturbios naturales o humanos.\n* No distingue causas de deforestación: GFW detecta pérdida de bosque, pero no diferencia entre agricultura, incendios, minería, urbanización u otros factores sin un análisis complementario.\n\nDatos Satelitales Utilizados\n* Imágenes Landsat (NASA/USGS) con resolución de 30 metros.\n* Sentinel-2 (ESA) para alertas de mayor precisión.\n* Datos de radar como GEDI (NASA) y Radar de Apertura Sintética (SAR).\n\nDetección de Pérdida y Ganancia de Bosque\n* Pérdida de bosque: Se refiere a la eliminación completa de la cobertura arbórea con base en el modelo de la Universidad de Maryland (UMD) liderado por Matthew Hansen.\n* Ganancia de bosque: Representa áreas donde la cobertura forestal se ha expandido.\n* Alertas de deforestación en tiempo casi real:\n* GLAD (UMD): Detecta cambios semanales con Landsat y Sentinel-2.\n* RADD (Wageningen University): Alertas específicas para los trópicos con datos de radar.\n\nAlgoritmos de análisis\n* Modelos de aprendizaje automático para diferenciar entre deforestación natural y causada por el hombre.\n* Comparación de imágenes satelitales de diferentes fechas para identificar cambios abruptos.\n* Filtros de corrección para evitar falsas alarmas debido a nubes o errores de sensor.\n\nValidación y Refinamiento\n* Los datos son validados con estudios de campo, imágenes de mayor resolución y otros conjuntos de datos (ej. GEDI de la NASA para estructura de bosque).\n* Se integran fuentes adicionales como FIRMS de NASA para monitorear incendios forestales.\n\nTemporalidad y Actualización\n* Alertas de deforestación (GLAD, RADD): Se generan semanalmente o cada pocos días, pero pueden requerir validación adicional.\n* Mapas anuales de pérdida de bosque: Se actualizan cada año con datos históricos desde el 2000, pero tienen un rezago de varios meses.\n* Datos de incendios y degradación: Se deben complementar con información de sistemas como FIRMS de NASA."
        }
    }
]

EXPECTED_MAPS_DATA = [
    {
        "id": 0,
        "name": "Global Forest Watch",
        "alias": "GFW 2020-2023",
        "baseline": 2020,
        "comparedAgainst": 2023,
        "coverage": "Superficie terrestre global (excluyendo la Antártida y otras islas del Ártico)",
        "details": "Global Forest Watch, en colaboración con Nasa, Universidad de Maryland y Google",
        "resolution": "30 x 30 metros",
        "contentDate": "Cambio forestal mundial entre 2000 y 2023",
        "updateFrequency": "Anual",
        "source": "https://glad.earthengine.app/view/global-forest-change#bl=off;old=off;dl=1;lon=20;lat=10;zoom=3;",
        "disclaimer": "Definiciones y Limitaciones de los Datos\n\n  * Definición de bosque: GFW usa la definición de la Universidad de Maryland (UMD), que considera bosques como áreas con un dosel de al menos 30% y árboles de más de 5 metros de altura. Esto puede no coincidir con definiciones legales o ecológicas en algunos países.\n* Deforestación ≠ conversión de uso de suelo: La pérdida de cobertura arbórea detectada no siempre implica conversión permanente, ya que incluye tala selectiva, incendios temporales y otros disturbios naturales o humanos.\n* No distingue causas de deforestación: GFW detecta pérdida de bosque, pero no diferencia entre agricultura, incendios, minería, urbanización u otros factores sin un análisis complementario.\n\nDatos Satelitales Utilizados\n* Imágenes Landsat (NASA/USGS) con resolución de 30 metros.\n* Sentinel-2 (ESA) para alertas de mayor precisión.\n* Datos de radar como GEDI (NASA) y Radar de Apertura Sintética (SAR).\n\nDetección de Pérdida y Ganancia de Bosque\n* Pérdida de bosque: Se refiere a la eliminación completa de la cobertura arbórea con base en el modelo de la Universidad de Maryland (UMD) liderado por Matthew Hansen.\n* Ganancia de bosque: Representa áreas donde la cobertura forestal se ha expandido.\n* Alertas de deforestación en tiempo casi real:\n* GLAD (UMD): Detecta cambios semanales con Landsat y Sentinel-2.\n* RADD (Wageningen University): Alertas específicas para los trópicos con datos de radar.\n\nAlgoritmos de análisis\n* Modelos de aprendizaje automático para diferenciar entre deforestación natural y causada por el hombre.\n* Comparación de imágenes satelitales de diferentes fechas para identificar cambios abruptos.\n* Filtros de corrección para evitar falsas alarmas debido a nubes o errores de sensor.\n\nValidación y Refinamiento\n* Los datos son validados con estudios de campo, imágenes de mayor resolución y otros conjuntos de datos (ej. GEDI de la NASA para estructura de bosque).\n* Se integran fuentes adicionales como FIRMS de NASA para monitorear incendios forestales.\n\nTemporalidad y Actualización\n* Alertas de deforestación (GLAD, RADD): Se generan semanalmente o cada pocos días, pero pueden requerir validación adicional.\n* Mapas anuales de pérdida de bosque: Se actualizan cada año con datos históricos desde el 2000, pero tienen un rezago de varios meses.\n* Datos de incendios y degradación: Se deben complementar con información de sistemas como FIRMS de NASA."
    }
]

@patch("app.modules.deforestation_analysis.router.get_all_maps")
def test_get_maps(mock_get_all_maps):
    mock_get_all_maps.return_value = MAPS_MOCK_DATA

    response = client.get("/deforestation_analysis/get-maps")
    assert response.status_code == 200
    json_response = response.json()
    print(json_response)
    assert json_response == EXPECTED_MAPS_DATA


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
            "documents": [
                {
                    "name": "Document 1",
                    "url": "https://example.com/document1.pdf",
                }
            ],
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
            "documents": [
                {
                    "name": "Document 1",
                    "url": "https://example.com/document1.pdf",
                }
            ],
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
@patch("app.modules.deforestation_analysis.router.get_deforestation_ratio")
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
        "raster_filename": "deforestation_map_a",
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
