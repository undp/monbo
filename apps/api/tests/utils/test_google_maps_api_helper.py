import asyncio
import base64
import logging
from io import BytesIO

import httpx
import pytest
from PIL import Image
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


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (4, 4), (10, 80, 10)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def satellite_calls(monkeypatch):
    """Google answers with a small image; returns the list of requested URLs."""
    monkeypatch.setattr(helper_module, "GCP_MAPS_PLATFORM_API_KEY", API_KEY)
    monkeypatch.setattr(
        helper_module, "GCP_MAPS_PLATFORM_SIGNATURE_SECRET", SIGNATURE_SECRET
    )
    helper_module.satellite_image_cache.clear()
    calls: list[str] = []
    content = _png_bytes()

    async def ok(self, url, **kwargs):
        calls.append(url)
        await asyncio.sleep(0.01)  # concurrent requests overlap
        return httpx.Response(200, content=content, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", ok)
    yield calls
    helper_module.satellite_image_cache.clear()


def test_one_satellite_call_per_farm(satellite_calls):
    """The same farm's images for 3 maps, concurrent or not, call Google once."""
    farm = Point(-76.3, -0.2)

    async def run():
        concurrent = await asyncio.gather(
            *(
                GoogleMapsAPIHelper.get_google_maps_satellite_image(farm, 15)
                for _ in range(3)
            )
        )
        later = await GoogleMapsAPIHelper.get_google_maps_satellite_image(farm, 15)
        return [*concurrent, later]

    images = asyncio.run(run())
    assert len(satellite_calls) == 1
    assert all(image.size == (4, 4) for image in images)
    assert len({id(image) for image in images}) == 4  # each caller its own image

    # Another farm, or the same one at another zoom, is another call.
    asyncio.run(
        GoogleMapsAPIHelper.get_google_maps_satellite_image(Point(-76.4, -0.2), 15)
    )
    asyncio.run(GoogleMapsAPIHelper.get_google_maps_satellite_image(farm, 16))
    assert len(satellite_calls) == 3


def test_a_failed_satellite_call_is_retried(google_maps, monkeypatch):
    helper_module.satellite_image_cache.clear()
    farm = Point(-76.3, -0.2)
    with pytest.raises(GoogleMapsAPIError):
        asyncio.run(GoogleMapsAPIHelper.get_google_maps_satellite_image(farm, 15))
    assert len(helper_module.satellite_image_cache) == 0

    content = _png_bytes()

    async def ok(self, url, **kwargs):
        return httpx.Response(200, content=content, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", ok)
    image = asyncio.run(GoogleMapsAPIHelper.get_google_maps_satellite_image(farm, 15))
    assert image.size == (4, 4)
    helper_module.satellite_image_cache.clear()
