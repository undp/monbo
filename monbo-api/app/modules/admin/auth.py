"""Admin authentication: one long passkey per country, exchanged for a short-lived
token that only administers that country.

The API only knows the SHA-256 of each passkey, from the country registry
(`countries.json` under MAPS_ROOT). A passkey that matches an enabled country gets a
token signed with `ADMIN_SESSION_SECRET` (HMAC-SHA256), sent back as
`Authorization: Bearer <token>`. The token carries the country and a fingerprint of
its passkey hash, checked against the registry on every call: rotating or disabling
a country signs its admins out at once, and rotating the secret signs everyone out.
"""

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import env
from app.config.logger import get_logger
from app.modules.layers.store import LayoutError, get_layers_root

logger = get_logger("modules.admin.auth")

MAX_FAILED_LOGINS = 5
# Upper bound on the IPs the login rate limiter tracks at once.
MAX_TRACKED_IPS = 1000
FAILED_LOGIN_WINDOW_SECONDS = 15 * 60


# Characters of the passkey hash a token carries, to notice a rotated passkey.
KEY_FINGERPRINT_LENGTH = 16


def admin_enabled() -> bool:
    """The admin needs the session secret and a per-country layers root."""
    if env.ADMIN_SESSION_SECRET is None:
        return False
    try:
        return get_layers_root().is_per_country()
    except LayoutError:
        return False


# --- Passkey ---------------------------------------------------------------------


def hash_passkey(passkey: str) -> str:
    return hashlib.sha256(passkey.encode("utf-8")).hexdigest()


def country_for_passkey(passkey: str) -> dict | None:
    """The enabled country whose passkey this is, or None.

    Compares against every enabled country in constant time and never stops early,
    so the timing reveals neither how many countries there are nor which matched.
    """
    submitted = hash_passkey(passkey)
    match = None
    for country in get_layers_root().read_registry() or []:
        if country["enabled"] and hmac.compare_digest(
            submitted, country["passkey_hash"]
        ):
            match = country
    return match


# --- Session tokens ----------------------------------------------------------------


@dataclass(frozen=True)
class Session:
    issued_at: int
    expires_at: int
    # The country this session administers, and the start of its passkey hash.
    country: str
    key_fingerprint: str


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str) -> str:
    assert env.ADMIN_SESSION_SECRET is not None
    digest = hmac.new(
        env.ADMIN_SESSION_SECRET.encode("utf-8"), payload.encode("ascii"), "sha256"
    ).digest()
    return _b64encode(digest)


def issue_token(country: dict, now: float | None = None) -> tuple[str, Session]:
    """A token for a registry entry (`code`, `passkey_hash`)."""
    issued_at = int(time.time() if now is None else now)
    session = Session(
        issued_at,
        issued_at + env.ADMIN_SESSION_TTL_MINUTES * 60,
        country["code"],
        country["passkey_hash"][:KEY_FINGERPRINT_LENGTH],
    )
    claims: dict[str, int | str] = {
        "iat": session.issued_at,
        "exp": session.expires_at,
        "jti": secrets.token_hex(8),
        "country": session.country,
        "kid": session.key_fingerprint,
    }
    payload = _b64encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    return f"{payload}.{_sign(payload)}", session


def verify_token(token: str, now: float | None = None) -> Session | None:
    """The session a token stands for, or None if it is forged, altered or expired.
    It doesn't check the registry: `require_admin` does."""
    payload, _, signature = token.partition(".")
    if not payload or not signature or not token.isascii():
        return None
    if not hmac.compare_digest(_sign(payload), signature):
        return None
    try:
        claims = json.loads(_b64decode(payload))
        session = Session(
            int(claims["iat"]),
            int(claims["exp"]),
            str(claims["country"]),
            str(claims["kid"]),
        )
    except (binascii.Error, ValueError, KeyError, TypeError):
        # Tokens from before per-country admins have no country: rejected.
        return None
    if session.expires_at <= (time.time() if now is None else now):
        return None
    return session


# --- Failed-login rate limit -------------------------------------------------------


class LoginRateLimiter:
    """At most `max_failures` failed logins per client IP within `window_seconds`.

    In memory: the API runs as a single process on a single replica.
    """

    def __init__(
        self,
        max_failures: int = MAX_FAILED_LOGINS,
        window_seconds: float = FAILED_LOGIN_WINDOW_SECONDS,
        clock=time.monotonic,
    ):
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def try_acquire(self, ip: str) -> int | None:
        """Start a login attempt from `ip`.

        Returns None and counts the attempt as a failure, or the seconds until `ip`
        may try again if it is blocked. Checking and counting happen under one lock,
        so parallel attempts can't all get past the limit; `reset` forgets them after
        a successful login.
        """
        with self._lock:
            failures = self._prune(ip)
            if len(failures) >= self.max_failures:
                return max(
                    1, int(failures[0] + self.window_seconds - self._clock()) + 1
                )
            failures.append(self._clock())
            return None

    def reset(self, ip: str) -> None:
        with self._lock:
            self._failures.pop(ip, None)

    def _prune(self, ip: str) -> deque[float]:
        cutoff = self._clock() - self.window_seconds
        failures = self._failures.setdefault(ip, deque())
        while failures and failures[0] <= cutoff:
            failures.popleft()
        if len(self._failures) > MAX_TRACKED_IPS:
            self._sweep(cutoff, keep=ip)
        return failures

    def _sweep(self, cutoff: float, keep: str) -> None:
        """Keep the table bounded: forget IPs with no failure inside the window, then,
        if many IPs are still failing, the ones that started failing first."""
        for other in [
            k
            for k, v in self._failures.items()
            if k != keep and (not v or v[-1] <= cutoff)
        ]:
            del self._failures[other]
        excess = len(self._failures) - int(MAX_TRACKED_IPS * 0.9)
        if excess > 0:
            # Dicts keep insertion order: the first keys are the oldest entries.
            for other in [k for k in self._failures if k != keep][:excess]:
                del self._failures[other]


login_rate_limiter = LoginRateLimiter()


def client_ip(request: Request) -> str:
    """The caller's IP: the last `X-Forwarded-For` hop (appended by the Container Apps
    ingress, so the client can't forge it), or the connection's peer."""
    forwarded = request.headers.get("x-forwarded-for", "")
    hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
    if hops:
        return hops[-1]
    return request.client.host if request.client else "unknown"


# --- Dependencies ------------------------------------------------------------------


def check_origin(request: Request) -> None:
    """Admin routes only accept browser calls from the configured frontend origin."""
    allowed = env.ADMIN_ALLOWED_ORIGIN
    origin = request.headers.get("origin")
    if allowed and origin and origin.rstrip("/").lower() != allowed.lower():
        raise HTTPException(status_code=403, detail="Origin not allowed")


_bearer = HTTPBearer(auto_error=False, description="Admin session token")


def _session_still_valid(session: Session) -> bool:
    """The token's country is still registered and enabled, with the same passkey."""
    country = get_layers_root().registered_country(session.country)
    return (
        country is not None
        and country["enabled"]
        and country["passkey_hash"].startswith(session.key_fingerprint)
        and len(session.key_fingerprint) == KEY_FINGERPRINT_LENGTH
    )


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Session:
    session = verify_token(credentials.credentials) if credentials else None
    if session is None or not _session_still_valid(session):
        raise HTTPException(
            status_code=401,
            detail="Admin session required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return session
