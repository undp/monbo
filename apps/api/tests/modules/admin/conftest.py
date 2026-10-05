import pytest
from fastapi.testclient import TestClient

from app.config import env
from app.main import create_app
from app.modules.admin import auth
from app.modules.admin.auth import LoginRateLimiter
from tests.conftest import LayersDir
from tests.modules.admin.support import SECRET, bearer, login


class AdminCountry(LayersDir):
    """The folder of the country the admin fixtures log in as (CO)."""

    def __init__(self, country_root, code):
        super().__init__(country_root.root / code)
        self.code = code
        self.store = country_root.store(code)
        # Ingestion jobs and the share's staging area live at the root.
        self.jobs = country_root.layers_root.flat


@pytest.fixture
def admin_env(monkeypatch, country_root):
    country_root.register("CO", "EC", "CR")
    monkeypatch.setattr(env, "ADMIN_SESSION_SECRET", SECRET)
    monkeypatch.setattr(env, "ADMIN_SESSION_TTL_MINUTES", 60)
    monkeypatch.setattr(env, "ADMIN_ALLOWED_ORIGIN", None)
    monkeypatch.setattr(auth, "login_rate_limiter", LoginRateLimiter())


@pytest.fixture
def colombia(country_root, admin_env):
    return AdminCountry(country_root, "CO")


@pytest.fixture
def client(admin_env):
    return TestClient(create_app())


@pytest.fixture
def admin_headers(client):
    return bearer(login(client).json()["token"])
