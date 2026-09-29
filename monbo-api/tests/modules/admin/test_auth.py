import json
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
from app.modules.layers.store import get_layers_root
from tests.modules.admin.support import COUNTRY_PASSKEYS, PASSKEY, bearer, login

API_DIR = Path(__file__).parents[3]


# --- Opt-in ----------------------------------------------------------------------


def registered(code):
    return get_layers_root().registered_country(code)


def test_admin_routes_do_not_exist_without_configuration():
    client = TestClient(default_app)

    assert env.ADMIN_SESSION_SECRET is None
    assert client.post("/admin/session", json={"passkey": "x"}).status_code == 404
    assert client.get("/admin/session").status_code == 404
    paths = client.get("/openapi.json").json()["paths"]
    assert not [path for path in paths if path.startswith("/admin")]


def test_a_flat_root_keeps_admin_off_and_warns(maps_root, monkeypatch, caplog):
    maps_root.write_index([])
    monkeypatch.setattr(env, "ADMIN_SESSION_SECRET", "s" * 48)

    with caplog.at_level(logging.WARNING, logger="app"):
        client = TestClient(create_app())

    assert client.post("/admin/session", json={"passkey": PASSKEY}).status_code == 404
    assert "Layers admin disabled" in caplog.text
    assert "per-country layout" in caplog.text


def test_a_per_country_root_without_the_secret_keeps_admin_off(country_root):
    country_root.register("CO")

    client = TestClient(create_app())

    assert client.post("/admin/session", json={"passkey": PASSKEY}).status_code == 404


def test_a_leftover_passkey_hash_is_ignored_with_a_warning(
    admin_env, monkeypatch, caplog
):
    monkeypatch.setattr(env, "LEGACY_ADMIN_PASSKEY_HASH_SET", True)

    with caplog.at_level(logging.WARNING, logger="app"):
        create_app()

    assert "ADMIN_PASSKEY_HASH is ignored" in caplog.text


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
    assert body["country"] == "CO"
    assert body["token"].count(".") == 1
    expires = datetime.fromisoformat(body["expiresAt"].replace("Z", "+00:00"))
    minutes = (expires - before).total_seconds() / 60
    assert 59 <= minutes <= 61


def test_each_passkey_logs_in_as_its_country(client):
    for code, passkey in COUNTRY_PASSKEYS.items():
        token = login(client, passkey=passkey).json()["token"]
        session = client.get("/admin/session", headers=bearer(token)).json()
        assert session["country"] == code


def test_wrong_passkey_is_rejected_generically(client):
    response = login(client, passkey="nope")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


def test_a_disabled_country_cannot_log_in(client, country_root):
    registry = get_layers_root().read_registry()
    for country in registry:
        if country["code"] == "EC":
            country["enabled"] = False
    country_root.write_registry(registry)

    response = login(client, passkey=COUNTRY_PASSKEYS["EC"])

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}
    assert login(client).status_code == 200


def test_registry_changes_apply_without_a_restart(client, country_root):
    passkey = "peru passkey " * 5
    registry = get_layers_root().read_registry()
    country_root.write_registry(
        [
            *registry,
            {"code": "PE", "passkey_hash": hash_passkey(passkey), "enabled": True},
        ]
    )

    assert login(client, passkey=passkey).json()["country"] == "PE"


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
    assert response.json()["country"] == "CO"


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
    token, _ = issue_token(registered("CO"), now=time.time() - 61 * 60)

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


def edit_registry(country_root, code, **changes):
    registry = get_layers_root().read_registry()
    for country in registry:
        if country["code"] == code:
            country.update(changes)
    country_root.write_registry(registry)


def test_rotating_a_country_passkey_ends_its_sessions_only(client, country_root):
    colombia = login(client).json()["token"]
    ecuador = login(client, passkey=COUNTRY_PASSKEYS["EC"]).json()["token"]

    edit_registry(country_root, "CO", passkey_hash=hash_passkey("new " * 20))

    assert client.get("/admin/session", headers=bearer(colombia)).status_code == 401
    assert client.get("/admin/session", headers=bearer(ecuador)).status_code == 200
    assert login(client).status_code == 401
    assert login(client, passkey="new " * 20).status_code == 200


def test_disabling_a_country_ends_its_sessions(client, country_root):
    token = login(client).json()["token"]

    edit_registry(country_root, "CO", enabled=False)

    assert client.get("/admin/layers", headers=bearer(token)).status_code == 401


def test_tokens_without_a_country_are_rejected(client):
    """Tokens from before per-country admins, validly signed."""
    now = int(time.time())
    claims = {"iat": now, "exp": now + 3600, "jti": "x"}
    payload = auth._b64encode(json.dumps(claims).encode())
    token = f"{payload}.{auth._sign(payload)}"

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
    assert "Admin login succeeded from 203.0.113.7 for CO" in caplog.text
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
