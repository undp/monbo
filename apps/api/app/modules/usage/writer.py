"""Records usage events: one JSON line on stdout, and appended to the month's event
file when `USAGE_DIR` is set (design decisions 1 and 2).

Each process writes its own file, `<USAGE_DIR>/<YYYY-MM>/<replica>-<pid>.jsonl`, so
replicas and uvicorn workers never append to the same file; a lock serializes the
writes of one process. Recording never raises: a failure is logged and the request
that caused the event carries on.
"""

import logging
import os
import re
import socket
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.config import env
from app.config.logger import get_logger

from .models import UsageEvent

logger = get_logger("usage")


class _StdoutHandler(logging.StreamHandler):
    """Writes to the current `sys.stdout`, even when it is replaced after import."""

    @property  # type: ignore[override]
    def stream(self):
        return sys.stdout

    @stream.setter
    def stream(self, value) -> None:
        pass


# Outside the "app" logger on purpose: plain lines, no color or prefix, so stdout (and
# Log Analytics) gets one parseable JSON object per event.
_events_logger = logging.getLogger("monbo.usage_events")
_events_logger.propagate = False
_events_logger.setLevel(logging.INFO)
if not _events_logger.handlers:
    _handler = _StdoutHandler()
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _events_logger.addHandler(_handler)

_write_lock = threading.Lock()
_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._-]")


def replica_name() -> str:
    """The Container Apps replica, or the host name outside Azure."""
    name = os.getenv("CONTAINER_APP_REPLICA_NAME") or socket.gethostname() or "local"
    return _UNSAFE_FILENAME_CHARS.sub("_", name)


def month_folder(at: datetime) -> str:
    return at.astimezone(timezone.utc).strftime("%Y-%m")


def event_file_path(usage_dir: str | os.PathLike[str], at: datetime) -> Path:
    return Path(usage_dir) / month_folder(at) / f"{replica_name()}-{os.getpid()}.jsonl"


def now() -> datetime:
    return datetime.now(timezone.utc)


def record(event: UsageEvent) -> None:
    """Write the event to stdout and, with `USAGE_DIR`, to its event file. Blocks on
    the share: call it from the threadpool, never from the event loop."""
    try:
        line = event.to_line()
        _events_logger.info(line)
        if env.USAGE_DIR is None:
            return
        path = event_file_path(env.USAGE_DIR, event.at)
        with _write_lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "a", encoding="utf-8") as file:
                file.write(line + "\n")
    except Exception:
        logger.exception("Could not record a %s usage event", event.type)
