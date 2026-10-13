import pytest
from fastapi.testclient import TestClient

from app.main import MissingLayersError, app, create_app
from app.modules.layers.store import LayersRoot, set_layers_root

client = TestClient(app)


def test_health_check():
    """
    Test the health check endpoint.

    This test sends a GET request to the root endpoint ("/") and verifies that the
    response status code is 200 (OK) and the response JSON contains the expected
    version and status information.

    Assertions:
        - The response status code should be 200.
        - The response JSON should carry the version and status, plus the resolved
          maps root and whether the API can write to it.
    """
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "0.1.0"
    assert body["status"] == "OK"
    assert body["mapsRoot"].endswith("app/maps")
    assert isinstance(body["mapsRootWritable"], bool)


def test_liveness_does_not_touch_the_maps_root(monkeypatch):
    """The liveness probe must answer even if the share is slow or gone."""
    from app.modules.layers.store import LayerStore

    def unavailable(self):
        raise AssertionError("liveness touched the maps root")

    monkeypatch.setattr(LayerStore, "is_writable", unavailable)
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "OK"}


@pytest.mark.parametrize("root_exists", [True, False])
def test_startup_fails_without_layers(tmp_path, root_exists):
    """The image carries no layers: an empty or missing MAPS_ROOT stops the startup."""
    root = tmp_path / "maps"
    if root_exists:
        root.mkdir()
    set_layers_root(LayersRoot(root))
    try:
        with pytest.raises(MissingLayersError, match="No layers at MAPS_ROOT"):
            with TestClient(create_app()):  # runs the startup hook
                pass
    finally:
        set_layers_root(None)


def test_startup_with_a_flat_root(maps_root):
    maps_root.write_index([])
    with TestClient(create_app()) as started:
        assert started.get("/health/live").status_code == 200


def test_startup_with_a_per_country_root(country_root):
    country_root.register("CO")
    with TestClient(create_app()) as started:
        assert started.get("/health/live").status_code == 200


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
