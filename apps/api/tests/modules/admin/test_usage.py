"""`GET /admin/usage`: the aggregates (spec "What the aggregates count"), for any
admin, and the monthly rollups (spec "Closed months are summarized once")."""

import json
import os
import shutil
from pathlib import Path

import pytest

from app.config import env
from app.modules.admin import usage as usage_route
from app.modules.usage import rollup

TODAY = "2026-11-09"
S1 = "11111111-1111-4111-8111-111111111111"
S2 = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def usage_dir(tmp_path, monkeypatch) -> Path:
    path = tmp_path / "usage"
    path.mkdir()
    monkeypatch.setattr(env, "USAGE_DIR", str(path))
    monkeypatch.setattr(
        usage_route, "today_utc", lambda: usage_route.date.fromisoformat(TODAY)
    )
    return path


def event(day, type, outcome="ok", session=None, country="CR", **fields) -> dict:
    source = "browser" if type.startswith("report") else "server"
    return {
        "v": 1,
        "at": f"{day}T12:00:00Z",
        "type": type,
        "outcome": outcome,
        "source": source,
        "session": session,
        "country": country,
        **fields,
    }


def write_events(usage_dir: Path, events: list[dict], name="r1-1.jsonl") -> Path:
    by_month: dict[str, list[dict]] = {}
    for item in events:
        by_month.setdefault(item["at"][:7], []).append(item)
    path = usage_dir
    for month, items in by_month.items():
        path = usage_dir / month / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as file:
            for item in items:
                file.write(json.dumps(item) + "\n")
    return path


def get_usage(client, admin_headers, **params):
    response = client.get("/admin/usage", params=params, headers=admin_headers)
    assert response.status_code == 200, response.text
    return response.json()


NOVEMBER = {"from": "2026-11-01", "to": TODAY}


def test_average_farms_per_upload(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [
            event("2026-11-02", "upload", farms=10, polygons=9, points=1),
            event("2026-11-03", "upload", farms=20, polygons=20, points=0),
            event("2026-11-04", "upload", farms=60, polygons=50, points=10),
            event("2026-11-04", "upload", outcome="invalid_input"),
        ],
    )
    upload = get_usage(client, admin_headers, **NOVEMBER)["totals"]["upload"]
    assert upload["ok"] == 3
    assert upload["errors"] == {"invalid_input": 1, "server_error": 0}
    assert (upload["farms"], upload["polygons"], upload["points"]) == (90, 79, 11)
    assert upload["avgFarmsPerUpload"] == 30


def test_sessions_are_distinct(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [event("2026-11-02", "analysis", session=S1, farms=1, maps=1)] * 3
        + [event("2026-11-05", "analysis", session=S2, farms=1, maps=1)]
        + [event("2026-11-05", "upload", session=S1, farms=1, polygons=1, points=0)],
    )
    totals = get_usage(client, admin_headers, **NOVEMBER)["totals"]
    assert totals["analysis"]["ok"] == 4
    assert totals["analysis"]["sessions"] == 2
    assert totals["upload"]["sessions"] == 1
    assert totals["sessions"] == 2


def test_pdf_versus_zip(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [event("2026-11-02", "report_requested", session=S1, farms=5)]
        + [event("2026-11-02", "report_downloaded", format="pdf", farms=5)] * 3
        + [event("2026-11-03", "report_downloaded", format="zip", farms=2)] * 2
        + [
            event(
                "2026-11-03",
                "report_downloaded",
                outcome="error",
                format="zip",
                farms=2,
            )
        ],
    )
    reports = get_usage(client, admin_headers, **NOVEMBER)["totals"]["reports"]
    assert reports == {
        "requested": 1,
        "requestedSessions": 1,
        "downloaded": {"pdf": 3, "zip": 2},
        "downloadErrors": 1,
        "farmsDownloaded": 19,
    }


def test_errors_are_split_by_kind(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [
            event("2026-11-02", "validation", outcome="invalid_input"),
            event("2026-11-02", "validation", outcome="server_error"),
            event("2026-11-02", "validation", farms=4, invalidFarms=1),
        ],
    )
    validation = get_usage(client, admin_headers, **NOVEMBER)["totals"]["validation"]
    assert validation["ok"] == 1
    assert validation["errors"] == {"invalid_input": 1, "server_error": 1}
    assert (validation["farms"], validation["invalidFarms"]) == (4, 1)


def test_old_clients_count_as_unknown_country(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [
            event("2026-11-02", "upload", country=None, farms=1, polygons=1, points=0),
            event("2026-11-02", "upload", country="CR", farms=1, polygons=1, points=0),
        ],
    )
    data = get_usage(client, admin_headers, **NOVEMBER)
    assert data["totals"]["upload"]["ok"] == 2
    assert data["totals"]["upload"]["sessions"] == 0
    assert [row["country"] for row in data["byCountry"]] == ["CR", "unknown"]
    assert data["byCountry"][1]["upload"]["ok"] == 1


def test_torn_and_invalid_lines_are_skipped(client, admin_headers, usage_dir):
    path = write_events(
        usage_dir, [event("2026-11-02", "analysis", farms=1, maps=1)] * 2
    )
    with open(path, "a", encoding="utf-8") as file:
        file.write('{"v":1,"type":"bogus"}\n{"v":1,"at":"2026-11-0')
    assert get_usage(client, admin_headers, **NOVEMBER)["totals"]["analysis"]["ok"] == 2


def test_every_process_file_is_read(client, admin_headers, usage_dir):
    write_events(usage_dir, [event("2026-11-02", "analysis")], name="r1-1.jsonl")
    write_events(usage_dir, [event("2026-11-02", "analysis")], name="r2-7.jsonl")
    assert get_usage(client, admin_headers, **NOVEMBER)["totals"]["analysis"]["ok"] == 2


def test_range_bounds_are_included(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [event(day, "analysis") for day in ("2026-11-01", "2026-11-05", "2026-11-06")],
    )
    data = get_usage(
        client, admin_headers, **{"from": "2026-11-01", "to": "2026-11-05"}
    )
    assert data["totals"]["analysis"]["ok"] == 2


def test_weekly_blocks_cover_every_overlapping_week(client, admin_headers, usage_dir):
    write_events(
        usage_dir,
        [event("2026-11-03", "analysis"), event("2026-11-04", "analysis")],
    )
    weekly = get_usage(client, admin_headers, **NOVEMBER)["weekly"]
    # 2026-11-01 is a Sunday: its ISO week starts on Monday 2026-10-26.
    assert [week["weekStart"] for week in weekly] == [
        "2026-10-26",
        "2026-11-02",
        "2026-11-09",
    ]
    assert [week["analysis"]["ok"] for week in weekly] == [0, 2, 0]


def test_default_range_is_the_last_30_days(client, admin_headers, usage_dir):
    data = get_usage(client, admin_headers)
    assert (data["from"], data["to"]) == ("2026-10-11", TODAY)
    assert data["sources"] == {
        "server": ["upload", "validation", "analysis"],
        "browser": ["reports"],
    }


def test_without_a_token(client, usage_dir):
    assert client.get("/admin/usage").status_code == 401


def test_any_country_sees_every_country(client, admin_headers, usage_dir):
    """The fixtures log in as CO."""
    write_events(
        usage_dir,
        [event("2026-11-02", "analysis", country="CR")]
        + [event("2026-11-03", "analysis", country="PE")] * 2,
    )
    data = get_usage(client, admin_headers, **NOVEMBER)
    assert data["totals"]["analysis"]["ok"] == 3
    assert {row["country"]: row["analysis"]["ok"] for row in data["byCountry"]} == {
        "CR": 1,
        "PE": 2,
    }


@pytest.mark.parametrize(
    "params",
    [
        pytest.param({"from": "2026-11-05", "to": "2026-11-01"}, id="from after to"),
        pytest.param({"from": "2025-01-01", "to": "2026-06-30"}, id="too long"),
        pytest.param({"from": "yesterday"}, id="not a date"),
    ],
)
def test_bad_range(client, admin_headers, usage_dir, params):
    response = client.get("/admin/usage", params=params, headers=admin_headers)
    assert response.status_code == 422


def test_a_year_is_allowed(client, admin_headers, usage_dir):
    get_usage(client, admin_headers, **{"from": "2025-11-10", "to": "2026-11-10"})


def test_not_configured(client, admin_headers, monkeypatch):
    monkeypatch.setattr(env, "USAGE_DIR", None)
    response = client.get("/admin/usage", headers=admin_headers)
    assert response.status_code == 503
    assert response.json() == {"detail": usage_route.NOT_CONFIGURED}


# --- Rollups -----------------------------------------------------------------

OCTOBER = {"from": "2026-10-01", "to": "2026-10-31"}
OCTOBER_EVENTS = [
    event("2026-10-02", "upload", session=S1, farms=3, polygons=3, points=0),
    event("2026-10-15", "analysis", session=S1, country="PE", farms=3, maps=2),
    event("2026-10-31", "report_downloaded", session=S2, format="pdf", farms=3),
]


def _rollup(usage_dir) -> Path:
    return usage_dir / "rollups" / "2026-10.json"


def _no_event_reads(monkeypatch):
    def fail(paths):
        raise AssertionError("read the event files")

    monkeypatch.setattr(rollup, "read_events", fail)


def test_first_request_builds_the_rollup(client, admin_headers, usage_dir):
    write_events(usage_dir, OCTOBER_EVENTS)
    data = get_usage(client, admin_headers, **OCTOBER)
    assert data["totals"]["sessions"] == 2
    assert json.loads(_rollup(usage_dir).read_text())["month"] == "2026-10"


def test_later_requests_read_only_the_rollup(
    client, admin_headers, usage_dir, monkeypatch
):
    write_events(usage_dir, OCTOBER_EVENTS)
    first = get_usage(client, admin_headers, **OCTOBER)
    _no_event_reads(monkeypatch)
    assert get_usage(client, admin_headers, **OCTOBER) == first


def test_a_changed_event_file_rebuilds_the_rollup(client, admin_headers, usage_dir):
    path = write_events(usage_dir, OCTOBER_EVENTS)
    get_usage(client, admin_headers, **OCTOBER)
    with open(path, "a", encoding="utf-8") as file:
        file.write(json.dumps(event("2026-10-20", "analysis", farms=1, maps=1)) + "\n")
    data = get_usage(client, admin_headers, **OCTOBER)
    assert data["totals"]["analysis"]["ok"] == 2


def test_a_new_event_file_rebuilds_the_rollup(client, admin_headers, usage_dir):
    write_events(usage_dir, OCTOBER_EVENTS)
    get_usage(client, admin_headers, **OCTOBER)
    write_events(usage_dir, [event("2026-10-20", "analysis")], name="restored.jsonl")
    assert get_usage(client, admin_headers, **OCTOBER)["totals"]["analysis"]["ok"] == 2


def test_a_version_change_rebuilds_the_rollup(
    client, admin_headers, usage_dir, monkeypatch
):
    write_events(usage_dir, OCTOBER_EVENTS)
    get_usage(client, admin_headers, **OCTOBER)
    monkeypatch.setattr(rollup, "ROLLUP_VERSION", rollup.ROLLUP_VERSION + 1)
    get_usage(client, admin_headers, **OCTOBER)
    data = json.loads(_rollup(usage_dir).read_text())
    assert data["v"] == rollup.ROLLUP_VERSION


def test_a_corrupt_rollup_is_rebuilt(client, admin_headers, usage_dir):
    write_events(usage_dir, OCTOBER_EVENTS)
    first = get_usage(client, admin_headers, **OCTOBER)
    _rollup(usage_dir).write_text('{"v":1,"month":"2026-10","sour')
    assert get_usage(client, admin_headers, **OCTOBER) == first
    json.loads(_rollup(usage_dir).read_text())


def test_the_current_month_has_no_rollup(client, admin_headers, usage_dir):
    write_events(usage_dir, [event("2026-11-02", "analysis")])
    get_usage(client, admin_headers, **NOVEMBER)
    assert not (usage_dir / "rollups" / "2026-11.json").exists()


def test_a_month_without_events_has_no_rollup(client, admin_headers, usage_dir):
    get_usage(client, admin_headers, **OCTOBER)
    assert not (usage_dir / "rollups").exists()


def test_same_answer_with_and_without_rollups(client, admin_headers, usage_dir):
    write_events(usage_dir, OCTOBER_EVENTS + [event("2026-11-02", "analysis")])
    params = {"from": "2026-10-10", "to": TODAY}
    with_rollups = get_usage(client, admin_headers, **params)
    assert _rollup(usage_dir).exists()
    shutil.rmtree(usage_dir / "rollups")
    assert get_usage(client, admin_headers, **params) == with_rollups
    assert get_usage(client, admin_headers, **params) == with_rollups


def test_rollup_folder_is_not_a_month(client, admin_headers, usage_dir):
    write_events(usage_dir, OCTOBER_EVENTS)
    stray = usage_dir / "rollups" / "r1-1.jsonl"
    stray.parent.mkdir()
    stray.write_text(json.dumps(event("2026-10-03", "analysis")) + "\n")
    assert get_usage(client, admin_headers, **OCTOBER)["totals"]["analysis"]["ok"] == 1


def test_a_failed_rollup_write_still_answers(client, admin_headers, usage_dir):
    write_events(usage_dir, OCTOBER_EVENTS)
    (usage_dir / "rollups").write_text("not a folder")
    data = get_usage(client, admin_headers, **OCTOBER)
    assert data["totals"]["upload"]["ok"] == 1
    assert [p for p in os.listdir(usage_dir) if p.endswith(".tmp")] == []
