import json
from pathlib import Path

import pytest

from app.config import env


@pytest.fixture
def usage_dir(tmp_path, monkeypatch) -> Path:
    """A throwaway USAGE_DIR, set as the API's."""
    path = tmp_path / "usage"
    monkeypatch.setattr(env, "USAGE_DIR", str(path))
    return path


def recorded(usage_dir: Path) -> list[dict]:
    """Every event line written under USAGE_DIR, oldest file first."""
    return [
        json.loads(line)
        for path in sorted(usage_dir.glob("[0-9][0-9][0-9][0-9]-[0-9][0-9]/*.jsonl"))
        for line in path.read_text(encoding="utf-8").splitlines()
    ]
