import json
import os
import threading
from datetime import datetime, timezone

from app.config import env
from app.modules.usage import writer
from app.modules.usage.models import UsageEvent
from tests.modules.usage.conftest import recorded

AT = datetime(2026, 11, 9, 14, 3, 12, 345000, tzinfo=timezone.utc)


def _event(**fields) -> UsageEvent:
    return UsageEvent.model_validate(
        {
            "at": AT,
            "type": "analysis",
            "outcome": "ok",
            "source": "server",
            "session": "3f1c2b8e-1d2a-4c5b-9e7f-0a1b2c3d4e5f",
            "country": "CR",
            "farms": 120,
            "maps": 3,
            **fields,
        }
    )


def test_file_path_from_month_replica_and_pid(monkeypatch, tmp_path):
    monkeypatch.setenv("CONTAINER_APP_REPLICA_NAME", "monbo-api--r7-abc")
    assert writer.event_file_path(tmp_path, AT) == (
        tmp_path / "2026-11" / f"monbo-api--r7-abc-{os.getpid()}.jsonl"
    )


def test_file_path_falls_back_to_the_host_name(monkeypatch, tmp_path):
    monkeypatch.delenv("CONTAINER_APP_REPLICA_NAME", raising=False)
    monkeypatch.setattr(writer.socket, "gethostname", lambda: "dev/laptop")
    assert (
        writer.event_file_path(tmp_path, AT).name == f"dev_laptop-{os.getpid()}.jsonl"
    )


def test_two_processes_write_two_files(monkeypatch, tmp_path):
    monkeypatch.setenv("CONTAINER_APP_REPLICA_NAME", "r1")
    monkeypatch.setattr(writer.os, "getpid", lambda: 7)
    first = writer.event_file_path(tmp_path, AT)
    monkeypatch.setattr(writer.os, "getpid", lambda: 8)
    assert writer.event_file_path(tmp_path, AT) != first


def test_one_line_per_event(usage_dir, capsys):
    writer.record(_event())
    writer.record(_event(type="upload", farms=2, polygons=1, points=1, maps=None))

    lines = recorded(usage_dir)
    assert len(lines) == 2
    assert lines[0] == {
        "v": 1,
        "at": "2026-11-09T14:03:12Z",
        "type": "analysis",
        "outcome": "ok",
        "source": "server",
        "session": "3f1c2b8e-1d2a-4c5b-9e7f-0a1b2c3d4e5f",
        "country": "CR",
        "farms": 120,
        "maps": 3,
    }
    # The stdout copy, one plain JSON object per line
    out = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert out == lines


def test_unknown_session_and_country_are_written_as_null(usage_dir):
    writer.record(_event(session=None, country=None))
    line = recorded(usage_dir)[0]
    assert line["session"] is None and line["country"] is None


def test_concurrent_writes_do_not_interleave(usage_dir):
    threads = [
        threading.Thread(target=lambda: [writer.record(_event()) for _ in range(50)])
        for _ in range(8)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert len(recorded(usage_dir)) == 400


def test_a_write_failure_is_logged_and_swallowed(monkeypatch, tmp_path, caplog):
    blocker = tmp_path / "not-a-folder"
    blocker.write_text("")
    monkeypatch.setattr(env, "USAGE_DIR", str(blocker))
    writer.record(_event())
    assert "Could not record a analysis usage event" in caplog.text


def test_no_file_without_usage_dir(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(env, "USAGE_DIR", None)
    monkeypatch.chdir(tmp_path)
    writer.record(_event())
    assert list(tmp_path.iterdir()) == []
    assert '"type":"analysis"' in capsys.readouterr().out


def test_usage_folder_is_not_a_country(country_root):
    """Spec "Not a country folder": USAGE_DIR under the layers root."""
    country_root.register("CR")
    (country_root.root / "usage" / "2026-11").mkdir(parents=True)
    (country_root.root / "usage" / "2026-11" / "r1-1.jsonl").write_text("{}\n")

    # Countries come from the registry, never from listing folders.
    assert country_root.layers_root.enabled_countries() == {"CR"}
    assert country_root.layers_root.layers() == []
    assert country_root.layers_root.public_countries() == []
