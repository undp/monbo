from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_check():
    """
    Test the health check endpoint.

    This test sends a GET request to the root endpoint ("/") and verifies that the
    response status code is 200 (OK) and the response JSON contains the expected
    version and status information.

    Assertions:
        - The response status code should be 200.
        - The response JSON should be {"version": "0.1.0", "status": "OK"}.
    """
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"version": "0.1.0", "status": "OK"}


def test_download_geojson_with_valid_content():
    """
    Test the /download-geojson endpoint with a valid JSON string as the "content" parameter.

    This test sends a GET request to the /download-geojson endpoint with a valid JSON string
    as the "content" parameter and verifies that the response status code is 200 (OK) and the
    response content type is 'application/json'.

    Assertions:
        - The response status code should be 200.
        - The response content type should be 'application/json'.
    """
    valid_json_content = '{"key": "value"}'
    response = client.get(f"/download-geojson?content={valid_json_content}")
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/json"


def test_download_geojson_with_invalid_content():
    """
    Test the /download-geojson endpoint with an invalid JSON string as the "content" parameter.

    This test sends a GET request to the /download-geojson endpoint with an invalid JSON string
    as the "content" parameter and verifies that the response status code is 400 (Bad Request)
    or another appropriate status code indicating invalid input.

    Assertions:
        - The response status code should be 400 or another appropriate error code.
    """
    invalid_json_content = '{"key": "value"'  # Missing closing brace
    response = client.get(f"/download-geojson?content={invalid_json_content}")
    assert response.status_code == 400


def test_download_geojson_without_content():
    """
    Test the /download-geojson endpoint without the "content" search parameter.

    This test sends a GET request to the /download-geojson endpoint without a "content" search
    parameter and verifies that the response status code is 400 (Bad Request) or another
    appropriate status code indicating a missing required parameter.

    Assertions:
        - The response status code should be 400 or another appropriate error code.
    """
    response = client.get("/download-geojson")
    assert response.status_code == 400


def test_polygons_validation_no_body():
    """
    Test case for validating the /polygons_validation/validate endpoint without a request body.

    This test sends a POST request to the /polygons_validation/validate endpoint without any
    request body and asserts that the response status code is 422, indicating that the request
    is unprocessable due to missing required data.

    Steps:
    1. Send a POST request to the /polygons_validation/validate endpoint without a body.
    2. Assert that the response status code is 422.

    Expected Result:
    - The response status code should be 422, indicating that the server cannot process the request
        due to missing required data.
    """
    response = client.post("/polygons_validation/validate")
    assert response.status_code == 422


def test_polygon_validation_valid_request():
    # TODO: Fix test case
    return
    """
    Test the polygon validation endpoint with a valid request body.
    The request body contains four polygons:
    1. A valid polygon with coordinates forming a square.
    2. A valid polygon with coordinates forming a square that intersects with the first polygon.
    3. A valid polygon with only one point.
    4. An invalid polygon with not enough points.
    The test verifies that the response status code is 200 and checks the response JSON for:
    - "validPolygons": A list containing valid polygons.
    - "inconsistentPolygons": A list containing inconsistent polygons.
    Assertions:
    - The length of "validPolygons" should be 1 (since the third polygons is valid).
    - The length of "inconsistentPolygons" should be 1 (first and second polygons overalaps).
    """
    body = body = {
        "polygons": [
            # Polygon with intersection
            {
                "id": "polygon1",
                "producerName": "Producer A",
                "farmCoordinates": "[(0,0),(1,0),(1,1),(0,1)]",
                "cropType": "Wheat",
                "productionDate": "2025-01-01",
                "productionQuantity": 100,
                "productionQuantityUnit": "kg",
                "country": "Country A",
                "region": "Region A",
                "association": "Association A",
            },
            {
                "id": "polygon2",
                "producerName": "Producer B",
                "farmCoordinates": "[(0.5,0.5),(1.5,0.5),(1.5,1.5),(0.5,1.5)]",
                "cropType": "Corn",
                "productionDate": "2025-01-02",
                "productionQuantity": 200,
                "productionQuantityUnit": "kg",
                "country": "Country B",
                "region": "Region B",
                "association": "Association B",
            },
            # Point Polygon
            {
                "id": "polygon3",
                "producerName": "Producer C",
                "farmCoordinates": "[(10,10)]",
                "cropType": "Corn",
                "productionDate": "2025-01-02",
                "productionQuantity": 200,
                "productionQuantityUnit": "kg",
                "country": "Country C",
                "region": "Region C",
                "association": "Association C",
            },
            # Polygon with bad coordinates
            {
                "id": "polygon4",
                "producerName": "Producer C",
                "farmCoordinates": "[(10,10), (10,10)]",
                "cropType": "Corn",
                "productionDate": "2025-01-02",
                "productionQuantity": 200,
                "productionQuantityUnit": "kg",
                "country": "Country C",
                "region": "Region C",
                "association": "Association C",
            },
        ]
    }

    response = client.post("/polygons_validation/validate", json=body)

    assert response.status_code == 200
    data = response.json()

    assert "validPolygons" in data
    assert "inconsistentPolygons" in data
    assert len(data["validPolygons"]) == 1  # Both polygons overlap
    assert len(data["inconsistentPolygons"]) == 1
