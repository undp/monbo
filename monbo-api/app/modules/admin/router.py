from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from . import auth
from .auth import Session, client_ip, issue_token, passkey_matches, require_admin

logger = auth.logger

router = APIRouter()


class LoginBody(BaseModel):
    passkey: str = Field(min_length=1, max_length=1024)


class SessionData(BaseModel):
    token: str
    expiresAt: str


class SessionStatus(BaseModel):
    expiresAt: str


def _iso(timestamp: int) -> str:
    return (
        datetime.fromtimestamp(timestamp, tz=timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


@router.post("/session", response_model=SessionData)
def create_session(body: LoginBody, request: Request):
    """
    Exchange the admin passkey for a session token.

    Send the token back as `Authorization: Bearer <token>` on every admin call. After
    5 failed attempts from the same IP within 15 minutes, logins from that IP get
    429 (even with the right passkey) until the window passes.
    """
    ip = client_ip(request)
    # Looked up on the module so tests can swap the limiter.
    limiter = auth.login_rate_limiter
    # Counted as a failure up front (and forgotten on success), so parallel guesses
    # can't all pass the check before any failure is recorded.
    retry_after = limiter.try_acquire(ip)
    if retry_after is not None:
        logger.warning("Admin login rate-limited for %s", ip)
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts, try again later",
            headers={"Retry-After": str(retry_after)},
        )

    if not passkey_matches(body.passkey):
        logger.warning("Admin login failed from %s", ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    limiter.reset(ip)
    logger.info("Admin login succeeded from %s", ip)
    token, session = issue_token()
    return SessionData(token=token, expiresAt=_iso(session.expires_at))


@router.get("/session", response_model=SessionStatus)
def get_session(session: Session = Depends(require_admin)):
    """Check that the current token is still valid and when it expires."""
    return SessionStatus(expiresAt=_iso(session.expires_at))
