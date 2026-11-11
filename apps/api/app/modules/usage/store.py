"""Reads the usage events of a month. With `writer`, the only code that touches the
event files (design decision 1, "The way back")."""

import os
import re
from collections.abc import Iterator
from datetime import date
from pathlib import Path

from pydantic import ValidationError

from .models import UsageEvent

_MONTH_FOLDER = re.compile(r"^\d{4}-\d{2}$")


def month_key(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def is_month_folder(name: str) -> bool:
    return bool(_MONTH_FOLDER.match(name))


def event_files(usage_dir: str | os.PathLike[str], month: str) -> list[Path]:
    """The month's event files, sorted; none when its folder doesn't exist."""
    if not is_month_folder(month):
        raise ValueError(f"not a month: {month!r}")
    folder = Path(usage_dir) / month
    if not folder.is_dir():
        return []
    return sorted(path for path in folder.glob("*.jsonl") if path.is_file())


def read_events(paths: list[Path]) -> Iterator[UsageEvent]:
    """The events in these files, skipping lines that don't parse or don't validate
    (a torn last line after a crash, or a hand edit)."""
    for path in paths:
        with open(path, encoding="utf-8", errors="replace") as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield UsageEvent.model_validate_json(line)
                except ValidationError:
                    continue
