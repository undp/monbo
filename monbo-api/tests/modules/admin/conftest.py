import pytest
from fastapi.testclient import TestClient

from app.config import env
from app.main import create_app
from app.modules.admin import auth
from app.modules.admin.auth import LoginRateLimiter, hash_passkey
from tests.modules.admin.support import PASSKEY, SECRET, bearer, login


@pytest.fixture
def admin_env(monkeypatch):
    monkeypatch.setattr(env, "ADMIN_PASSKEY_HASH", hash_passkey(PASSKEY))
    monkeypatch.setattr(env, "ADMIN_SESSION_SECRET", SECRET)
    monkeypatch.setattr(env, "ADMIN_SESSION_TTL_MINUTES", 60)
    monkeypatch.setattr(env, "ADMIN_ALLOWED_ORIGIN", None)
    monkeypatch.setattr(auth, "login_rate_limiter", LoginRateLimiter())


@pytest.fixture
def client(admin_env):
    return TestClient(create_app())


@pytest.fixture
def admin_headers(client):
    return bearer(login(client).json()["token"])
