"""Records an event for every upload, validation and analysis (design decision 5), and
caps the size of `POST /events` bodies (decision 6).

A pure ASGI middleware, so it sees every outcome: a 422 that FastAPI raises before the
route runs, and an unhandled exception. The route stays in charge of its own counts,
which it leaves with `note_usage`; the middleware adds them to the event on success.
"""

import json
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.models.maps import COUNTRY_CODE_PATTERN

from .models import UsageEvent
from .writer import logger, now, record

SESSION_HEADER = "x-monbo-session"
COUNTRY_HEADER = "x-monbo-country"
MODULE_HEADER = "x-monbo-module"

# POST path -> event type.
TRACKED_ROUTES = {
    "/farms/parse": "upload",
    "/polygons_validation/validate": "validation",
    "/deforestation_analysis/analize": "analysis",
}
EVENTS_PATH = "/events"
MAX_EVENT_BODY_BYTES = 2048
TOO_LARGE = f"Event body over {MAX_EVENT_BODY_BYTES} bytes"

_MODULES = ("polygons-validation", "deforestation-analysis")
_COUNTRY = re.compile(COUNTRY_CODE_PATTERN)
_STATE_KEY = "usage"


def note_usage(request: Request, **fields: Any) -> None:
    """Leave counts (and, for the analysis, the body's country) for the request's
    usage event. Counts only reach the event when the request succeeds."""
    noted = getattr(request.state, _STATE_KEY, None) or {}
    setattr(request.state, _STATE_KEY, {**noted, **fields})


def parse_session(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(UUID(value))
    except ValueError:
        return None


def parse_country(value: str | None) -> str | None:
    return value if value and _COUNTRY.match(value) else None


def parse_module(value: str | None) -> str | None:
    return value if value in _MODULES else None


def outcome_for(status: int | None) -> str:
    if status is None or status >= 500:
        return "server_error"
    if status >= 400:
        return "invalid_input"
    return "ok"


def record_request(
    event_type: str, status: int | None, headers: Headers, noted: dict | None
) -> None:
    """Record the event of a tracked request. Never raises."""
    noted = dict(noted or {})
    outcome = outcome_for(status)
    # The analysis takes its country from the body, not the header.
    if "country" in noted:
        country = noted.pop("country")
    else:
        country = parse_country(headers.get(COUNTRY_HEADER))
    try:
        event = UsageEvent.model_validate(
            {
                "at": now(),
                "type": event_type,
                "outcome": outcome,
                "source": "server",
                "session": parse_session(headers.get(SESSION_HEADER)),
                "country": country,
                "module": (
                    parse_module(headers.get(MODULE_HEADER))
                    if event_type == "upload"
                    else None
                ),
                **(noted if outcome == "ok" else {}),
            }
        )
    except Exception:
        logger.exception("Could not build a %s usage event", event_type)
        return
    record(event)


class UsageMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST":
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        if path == EVENTS_PATH:
            await self._capped(scope, receive, send)
        elif path in TRACKED_ROUTES:
            await self._tracked(TRACKED_ROUTES[path], scope, receive, send)
        else:
            await self.app(scope, receive, send)

    async def _tracked(
        self, event_type: str, scope: Scope, receive: Receive, send: Send
    ) -> None:
        headers = Headers(scope=scope)
        # The route's Request shares this dict: what `note_usage` leaves lands here.
        state = scope.setdefault("state", {})
        status: int | None = None

        async def send_and_watch(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_and_watch)
        except Exception:
            status = None
            raise
        finally:
            await run_in_threadpool(
                record_request, event_type, status, headers, state.get(_STATE_KEY)
            )

    async def _capped(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Answer 413 to a body over the cap, before the route parses it."""
        length = Headers(scope=scope).get("content-length")
        if length is not None and (
            not length.isdigit() or int(length) > MAX_EVENT_BODY_BYTES
        ):
            await _too_large(send)
            return

        # A body without Content-Length (chunked) is counted as it is read. FastAPI
        # re-raises an HTTPException from reading the body as is.
        received = 0

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_EVENT_BODY_BYTES:
                    raise HTTPException(status_code=413, detail=TOO_LARGE)
            return message

        await self.app(scope, counting_receive, send)


async def _too_large(send: Send) -> None:
    body = json.dumps({"detail": TOO_LARGE}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
