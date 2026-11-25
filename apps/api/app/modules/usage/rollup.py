"""Monthly rollups: a closed month's day summaries, built once from its event files
(design decision 8, spec "Closed months are summarized once").

`<USAGE_DIR>/rollups/<YYYY-MM>.json` is a cache. It records the version of the
figures and the signature of the event files it was built from (name, size and
modification time of each), and is rebuilt when either differs, or when it doesn't
parse. The event files stay the source of truth: deleting `rollups/` is always safe.
"""

import json
import os
import uuid
from datetime import date
from pathlib import Path

from .aggregate import DaySummary, Summaries, fold
from .store import event_files, month_key, read_events
from .writer import logger

# Bump it when the figures or the day summary change: every rollup is then rebuilt.
ROLLUP_VERSION = 1
ROLLUPS_FOLDER = "rollups"


def rollup_path(usage_dir: str | os.PathLike[str], month: str) -> Path:
    return Path(usage_dir) / ROLLUPS_FOLDER / f"{month}.json"


def _signature(files: list[Path]) -> list[list]:
    signature = []
    for path in files:
        stat = path.stat()
        signature.append([path.name, stat.st_size, stat.st_mtime_ns])
    return signature


def _load(path: Path, month: str, signature: list[list]) -> Summaries | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if (
            data.get("v") != ROLLUP_VERSION
            or data.get("month") != month
            or data.get("sources") != signature
        ):
            return None
        return {
            (date.fromisoformat(day["day"]), str(day["country"])): DaySummary.from_json(
                day
            )
            for day in data["days"]
        }
    except FileNotFoundError:
        return None
    except Exception:
        logger.warning("Ignoring unreadable usage rollup %s", path, exc_info=True)
        return None


def _save(path: Path, month: str, signature: list[list], summaries: Summaries) -> None:
    data = {
        "v": ROLLUP_VERSION,
        "month": month,
        "sources": signature,
        "days": [
            {"day": day.isoformat(), "country": country, **summary.to_json()}
            for (day, country), summary in sorted(summaries.items())
        ],
    }
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        # Two requests building the same month can only write the same content.
        os.replace(tmp, path)
    except Exception:
        logger.exception("Could not write usage rollup %s", path)
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def month_summaries(
    usage_dir: str | os.PathLike[str], month: str, current_month: str
) -> Summaries:
    """The month's day summaries: from its rollup when the month is closed (built
    when missing or stale), from its event files otherwise."""
    files = event_files(usage_dir, month)
    if month >= current_month:
        return fold(read_events(files))
    if not files:
        return {}
    # Taken before reading: a file that changes during the build makes the rollup
    # stale on the next request instead of hiding the change.
    signature = _signature(files)
    path = rollup_path(usage_dir, month)
    summaries = _load(path, month, signature)
    if summaries is None:
        summaries = fold(read_events(files))
        _save(path, month, signature, summaries)
    return summaries


def months_between(start: date, end: date) -> list[str]:
    months = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append(month_key(date(year, month, 1)))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months


def range_summaries(
    usage_dir: str | os.PathLike[str], start: date, end: date, today: date
) -> Summaries:
    summaries: Summaries = {}
    current_month = month_key(today)
    for month in months_between(start, end):
        summaries.update(month_summaries(usage_dir, month, current_month))
    return summaries
