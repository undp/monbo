import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import env
from app.main import app as default_app
from app.main import create_app
from app.modules.admin import auth
from app.modules.admin.auth import LoginRateLimiter, hash_passkey, issue_token
from app.modules.admin.passkey import generate

PASSKEY = "correct horse battery staple " * 3
SECRET = "s" * 48
API_DIR = Path(__file__).parents[3]


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


def login(client, passkey=PASSKEY, ip=None, origin=None):
    headers = {}
    if ip:
        headers["X-Forwarded-For"] = ip
    if origin:
        headers["Origin"] = origin
    return client.post("/admin/session", json={"passkey": passkey}, headers=headers)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- Opt-in ----------------------------------------------------------------------


def test_admin_routes_do_not_exist_without_configuration():
    client = TestClient(default_app)

    assert env.ADMIN_PASSKEY_HASH is None
    assert client.post("/admin/session", json={"passkey": "x"}).status_code == 404
    assert client.get("/admin/session").status_code == 404
    paths = client.get("/openapi.json").json()["paths"]
    assert not [path for path in paths if path.startswith("/admin")]


def test_partial_configuration_keeps_admin_off_and_warns(monkeypatch, caplog):
    monkeypatch.setattr(env, "ADMIN_PASSKEY_HASH", hash_passkey(PASSKEY))
    monkeypatch.setattr(env, "ADMIN_SESSION_SECRET", None)

    with caplog.at_level(logging.WARNING, logger="app"):
        client = TestClient(create_app())

    assert client.post("/admin/session", json={"passkey": PASSKEY}).status_code == 404
    assert "Layers admin disabled" in caplog.text


def test_warns_when_admin_writes_would_hit_the_bundled_layers(admin_env, caplog):
    assert env.MAPS_ROOT == "app/maps"

    with caplog.at_level(logging.WARNING, logger="app"):
        create_app()

    assert "admin writes will modify Git-tracked files" in caplog.text


def test_no_bundled_layers_warning_for_an_external_root(
    admin_env, monkeypatch, tmp_path, caplog
):
    monkeypatch.setattr(env, "MAPS_ROOT", str(tmp_path))

    with caplog.at_level(logging.WARNING, logger="app"):
        create_app()

    assert "Git-tracked" not in caplog.text


def test_admin_routes_are_documented_when_enabled(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/admin/session" in paths


# --- Login ---------------------------------------------------------------------


def test_correct_passkey_returns_a_token(client):
    before = datetime.now(timezone.utc)

    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token"].count(".") == 1
    expires = datetime.fromisoformat(body["expiresAt"].replace("Z", "+00:00"))
    minutes = (expires - before).total_seconds() / 60
    assert 59 <= minutes <= 61


def test_wrong_passkey_is_rejected_generically(client):
    response = login(client, passkey="nope")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_login_body_is_validated(client):
    assert client.post("/admin/session", json={}).status_code == 422
    assert client.post("/admin/session", json={"passkey": ""}).status_code == 422
    assert (
        client.post("/admin/session", json={"passkey": "x" * 1025}).status_code == 422
    )


# --- Bearer tokens -----------------------------------------------------------------


def test_valid_token_opens_admin_routes(client):
    token = login(client).json()["token"]

    response = client.get("/admin/session", headers=bearer(token))

    assert response.status_code == 200
    assert response.json()["expiresAt"].endswith("Z")


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": "Bearer not-a-token"},
        {"Authorization": "Bearer a.b.c"},
    ],
)
def test_missing_or_malformed_token_is_401(client, headers):
    response = client.get("/admin/session", headers=headers)

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_non_ascii_tokens_are_rejected_not_crashed(admin_env):
    # Header bytes arrive decoded as latin-1, so a raw client can send these.
    assert auth.verify_token("ñandú.ñandú") is None


def test_expired_token_is_401(client):
    token, _ = issue_token(now=time.time() - 61 * 60)

    assert client.get("/admin/session", headers=bearer(token)).status_code == 401


def test_tampered_token_is_401(client):
    token = login(client).json()["token"]
    payload, signature = token.split(".")
    # A payload claiming a far-future expiry, with the original signature.
    forged_payload = auth._b64encode(b'{"iat":0,"exp":99999999999,"jti":"x"}')

    for forged in (f"{forged_payload}.{signature}", f"{payload}.{signature[:-2]}AA"):
        assert client.get("/admin/session", headers=bearer(forged)).status_code == 401


def test_rotating_the_secret_invalidates_tokens(client, monkeypatch):
    token = login(client).json()["token"]
    monkeypatch.setattr(env, "ADMIN_SESSION_SECRET", "r" * 48)

    assert client.get("/admin/session", headers=bearer(token)).status_code == 401


# --- Rate limit and logging ----------------------------------------------------


def test_sixth_attempt_is_blocked_even_with_the_right_passkey(client):
    for _ in range(5):
        assert login(client, passkey="wrong", ip="203.0.113.7").status_code == 401

    response = login(client, ip="203.0.113.7")

    assert response.status_code == 429
    assert 0 < int(response.headers["Retry-After"]) <= 15 * 60
    # Other IPs are unaffected.
    assert login(client, ip="198.51.100.1").status_code == 200


def test_rate_limit_uses_the_last_forwarded_hop(client):
    # The client controls the first hops; the ingress appends the real one.
    for i in range(5):
        login(client, passkey="wrong", ip=f"10.0.0.{i}, 203.0.113.7")

    assert login(client, ip="10.0.0.99, 203.0.113.7").status_code == 429
    assert login(client, ip="203.0.113.8").status_code == 200


def test_a_successful_login_clears_the_failures(client):
    for _ in range(4):
        login(client, passkey="wrong", ip="203.0.113.7")
    assert login(client, ip="203.0.113.7").status_code == 200
    for _ in range(4):
        login(client, passkey="wrong", ip="203.0.113.7")

    assert login(client, ip="203.0.113.7").status_code == 200


def test_rate_limit_window_expires():
    now = [1000.0]
    limiter = LoginRateLimiter(clock=lambda: now[0])
    for _ in range(5):
        limiter.record_failure("ip")

    assert limiter.retry_after("ip") == 15 * 60 + 1
    now[0] += 15 * 60 + 1
    assert limiter.retry_after("ip") is None


def test_login_attempts_are_logged_without_the_passkey(client, caplog):
    with caplog.at_level(logging.INFO, logger="app"):
        login(client, passkey="wrong-guess-123", ip="203.0.113.7")
        login(client, ip="203.0.113.7")

    assert "Admin login failed from 203.0.113.7" in caplog.text
    assert "Admin login succeeded from 203.0.113.7" in caplog.text
    assert "wrong-guess-123" not in caplog.text
    assert PASSKEY.strip() not in caplog.text


# --- Origin and CORS -----------------------------------------------------------


def test_admin_routes_reject_other_origins(client, monkeypatch):
    monkeypatch.setattr(env, "ADMIN_ALLOWED_ORIGIN", "https://monbo.example.org")

    assert login(client, origin="https://evil.example").status_code == 403
    assert login(client, origin="https://monbo.example.org").status_code == 200
    assert login(client, origin="https://MONBO.example.org/").status_code == 200
    # Non-browser callers (curl, scripts) send no Origin.
    assert login(client).status_code == 200

    token = login(client).json()["token"]
    response = client.get(
        "/admin/session",
        headers={**bearer(token), "Origin": "https://evil.example"},
    )
    assert response.status_code == 403


def test_cors_preflight_allows_bearer_calls_without_credentials(client):
    response = client.options(
        "/admin/session",
        headers={
            "Origin": "https://monbo.example.org",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )

    assert response.status_code == 200
    allowed_methods = response.headers["access-control-allow-methods"]
    for method in ("GET", "POST", "PUT", "PATCH"):
        assert method in allowed_methods
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers
    assert "access-control-allow-credentials" not in response.headers


# --- Configuration and credentials -----------------------------------------------


@pytest.mark.parametrize(
    "variables, message",
    [
        ({"ADMIN_PASSKEY_HASH": "ABC"}, "ADMIN_PASSKEY_HASH must be a SHA-256"),
        ({"ADMIN_SESSION_SECRET": "short"}, "at least 32 bytes"),
        ({"ADMIN_SESSION_TTL_MINUTES": "0"}, "must be greater than 0"),
        ({"ADMIN_MAX_UPLOAD_MB": "lots"}, "must be a whole number"),
    ],
)
def test_invalid_admin_configuration_fails_at_startup(variables, message):
    result = subprocess.run(
        [sys.executable, "-c", "import app.config.env"],
        cwd=API_DIR,
        env={**os.environ, **variables},
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert message in result.stderr


def test_generated_credentials():
    credentials = generate()

    assert len(credentials["ADMIN_PASSKEY"]) >= 64
    assert credentials["ADMIN_PASSKEY_HASH"] == hash_passkey(
        credentials["ADMIN_PASSKEY"]
    )
    assert len(credentials["ADMIN_SESSION_SECRET"].encode()) >= 32
    assert generate()["ADMIN_PASSKEY"] != credentials["ADMIN_PASSKEY"]


def test_generated_credentials_work_end_to_end(monkeypatch):
    credentials = generate()
    monkeypatch.setattr(env, "ADMIN_PASSKEY_HASH", credentials["ADMIN_PASSKEY_HASH"])
    monkeypatch.setattr(
        env, "ADMIN_SESSION_SECRET", credentials["ADMIN_SESSION_SECRET"]
    )
    monkeypatch.setattr(auth, "login_rate_limiter", LoginRateLimiter())
    client = TestClient(create_app())

    token = login(client, passkey=credentials["ADMIN_PASSKEY"]).json()["token"]

    assert client.get("/admin/session", headers=bearer(token)).status_code == 200
