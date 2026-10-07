import asyncio
import base64
import logging

import httpx
import pytest
from shapely.geometry import Point

from app.utils.image_generation import GoogleMapsAPIHelper as helper_module
from app.utils.image_generation.errors import GoogleMapsAPIError
from app.utils.image_generation.GoogleMapsAPIHelper import GoogleMapsAPIHelper

API_KEY = "test-maps-api-key-123"
SIGNATURE_SECRET = base64.urlsafe_b64encode(b"test-signing-secret").decode()


@pytest.fixture
def google_maps(monkeypatch):
    """Point the helper at fake credentials and answer every request with 403."""
    monkeypatch.setattr(helper_module, "GCP_MAPS_PLATFORM_API_KEY", API_KEY)
    monkeypatch.setattr(
        helper_module, "GCP_MAPS_PLATFORM_SIGNATURE_SECRET", SIGNATURE_SECRET
    )

    async def forbidden(self, url, **kwargs):
        return httpx.Response(403, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", forbidden)


def test_google_maps_errors_dont_expose_the_api_key(google_maps, caplog):
    """Neither the logs nor the raised error carry the key or the signature, which
    are part of the request URL."""
    # On the helper's own logger: app.main sets the `app` logger to INFO.
    caplog.set_level(logging.DEBUG, logger=helper_module.logger.name)

    with pytest.raises(GoogleMapsAPIError) as raised:
        asyncio.run(
            GoogleMapsAPIHelper.get_google_maps_satellite_image(Point(-76.3, -0.2), 15)
        )

    assert "403" in str(raised.value)
    assert raised.value.__cause__ is None
    assert raised.value.__suppress_context__
    logged = caplog.text + str(raised.value)
    assert API_KEY not in logged
    assert "signature=" not in logged
    assert "center=" in caplog.text  # the debug line still says what was requested
