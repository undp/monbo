"""Usage aggregates: events folded into day summaries, and day summaries into the
blocks of `GET /admin/usage` (spec "What the aggregates count").

A day summary holds, for one UTC day and country, the counters of every figure and
the session IDs seen, each with a mask of the steps it took. Distinct sessions over
any range come from OR-ing the masks of its days, so they stay exact. Monthly rollups
store day summaries (`rollup.py`).
"""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, timedelta, timezone

from pydantic import BaseModel, Field

from .models import UsageEvent

UNKNOWN_COUNTRY = "unknown"

# A session's steps, as bits of its mask in a day summary.
ANY_EVENT = 1
UPLOADED = 2
VALIDATED = 4
ANALYZED = 8
REQUESTED_REPORT = 16
_OK_STEP = {"upload": UPLOADED, "validation": VALIDATED, "analysis": ANALYZED}
# The counts each successful server event adds to its figure.
_OK_COUNTS = {
    "upload": ("farms", "polygons", "points"),
    "validation": ("farms", "invalidFarms"),
    "analysis": ("farms",),
}


@dataclass
class DaySummary:
    counters: Counter[str] = field(default_factory=Counter)
    sessions: dict[str, int] = field(default_factory=dict)

    def add(self, event: UsageEvent) -> None:
        counters = self.counters
        step = 0
        if event.type in _OK_STEP:
            counters[f"{event.type}.{event.outcome}"] += 1
            if event.outcome == "ok":
                step = _OK_STEP[event.type]
                for name in _OK_COUNTS[event.type]:
                    counters[f"{event.type}.{name}"] += getattr(event, name) or 0
        elif event.type == "report_requested":
            if event.outcome == "ok":
                counters["reports.requested"] += 1
                step = REQUESTED_REPORT
        elif event.outcome == "ok":
            counters[f"reports.downloaded.{event.format}"] += 1
            counters["reports.farmsDownloaded"] += event.farms or 0
        else:
            counters["reports.downloadErrors"] += 1
        if event.session is not None:
            session = str(event.session)
            self.sessions[session] = self.sessions.get(session, 0) | ANY_EVENT | step

    def to_json(self) -> dict:
        return {"counters": dict(self.counters), "sessions": self.sessions}

    @classmethod
    def from_json(cls, data: dict) -> "DaySummary":
        return cls(
            counters=Counter({str(k): int(v) for k, v in data["counters"].items()}),
            sessions={str(k): int(v) for k, v in data["sessions"].items()},
        )


# (UTC day, country code or "unknown") -> its summary.
Summaries = dict[tuple[date, str], DaySummary]


def fold(events: Iterable[UsageEvent]) -> Summaries:
    summaries: Summaries = {}
    for event in events:
        key = (
            event.at.astimezone(timezone.utc).date(),
            event.country or UNKNOWN_COUNTRY,
        )
        summaries.setdefault(key, DaySummary()).add(event)
    return summaries


class ErrorCounts(BaseModel):
    invalid_input: int
    server_error: int


class UploadUsage(BaseModel):
    ok: int
    errors: ErrorCounts
    sessions: int = Field(description="Distinct sessions with at least one ok upload")
    farms: int
    polygons: int
    points: int
    avgFarmsPerUpload: float | None = Field(
        description="farms ÷ ok, or null without an ok upload"
    )


class ValidationUsage(BaseModel):
    ok: int
    errors: ErrorCounts
    sessions: int
    farms: int
    invalidFarms: int


class AnalysisUsage(BaseModel):
    ok: int
    errors: ErrorCounts
    sessions: int
    farms: int


class DownloadedReports(BaseModel):
    pdf: int = Field(description="Downloaded as one PDF")
    zip: int = Field(description="Downloaded as a ZIP of one PDF per farm")


class ReportsUsage(BaseModel):
    requested: int
    requestedSessions: int
    downloaded: DownloadedReports
    downloadErrors: int
    farmsDownloaded: int


class UsageBlock(BaseModel):
    sessions: int = Field(description="Distinct sessions with any event")
    upload: UploadUsage
    validation: ValidationUsage
    analysis: AnalysisUsage
    reports: ReportsUsage


class CountryUsage(UsageBlock):
    country: str = Field(description='A country code, or "unknown"')


class WeekUsage(UsageBlock):
    weekStart: date = Field(description="The ISO week's Monday (UTC)")


class UsageSources(BaseModel):
    server: list[str] = Field(description="Figures recorded by the server")
    browser: list[str] = Field(description="Figures reported by the browser")


class UsageReport(BaseModel):
    from_: date = Field(alias="from")
    to: date
    totals: UsageBlock
    byCountry: list[CountryUsage]
    weekly: list[WeekUsage]
    sources: UsageSources


def _block_fields(summaries: Iterable[DaySummary]) -> dict:
    counters: Counter[str] = Counter()
    sessions: dict[str, int] = {}
    for summary in summaries:
        counters.update(summary.counters)
        for session, mask in summary.sessions.items():
            sessions[session] = sessions.get(session, 0) | mask

    def distinct(step: int) -> int:
        return sum(1 for mask in sessions.values() if mask & step)

    def errors(kind: str) -> ErrorCounts:
        return ErrorCounts(
            invalid_input=counters[f"{kind}.invalid_input"],
            server_error=counters[f"{kind}.server_error"],
        )

    uploads = counters["upload.ok"]
    return {
        "sessions": distinct(ANY_EVENT),
        "upload": UploadUsage(
            ok=uploads,
            errors=errors("upload"),
            sessions=distinct(UPLOADED),
            farms=counters["upload.farms"],
            polygons=counters["upload.polygons"],
            points=counters["upload.points"],
            avgFarmsPerUpload=counters["upload.farms"] / uploads if uploads else None,
        ),
        "validation": ValidationUsage(
            ok=counters["validation.ok"],
            errors=errors("validation"),
            sessions=distinct(VALIDATED),
            farms=counters["validation.farms"],
            invalidFarms=counters["validation.invalidFarms"],
        ),
        "analysis": AnalysisUsage(
            ok=counters["analysis.ok"],
            errors=errors("analysis"),
            sessions=distinct(ANALYZED),
            farms=counters["analysis.farms"],
        ),
        "reports": ReportsUsage(
            requested=counters["reports.requested"],
            requestedSessions=distinct(REQUESTED_REPORT),
            downloaded=DownloadedReports(
                pdf=counters["reports.downloaded.pdf"],
                zip=counters["reports.downloaded.zip"],
            ),
            downloadErrors=counters["reports.downloadErrors"],
            farmsDownloaded=counters["reports.farmsDownloaded"],
        ),
    }


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def usage_report(summaries: Summaries, start: date, end: date) -> UsageReport:
    """The response of `GET /admin/usage` for `[start, end]`, both included."""
    in_range = {key: s for key, s in summaries.items() if start <= key[0] <= end}

    countries = sorted(
        {country for _, country in in_range},
        key=lambda code: (code == UNKNOWN_COUNTRY, code),
    )
    by_country = [
        CountryUsage(
            country=code,
            **_block_fields(s for (_, c), s in in_range.items() if c == code),
        )
        for code in countries
    ]

    weekly = []
    week = _week_start(start)
    while week <= end:
        week_end = week + timedelta(days=6)
        weekly.append(
            WeekUsage(
                weekStart=week,
                **_block_fields(
                    s for (day, _), s in in_range.items() if week <= day <= week_end
                ),
            )
        )
        week += timedelta(days=7)

    return UsageReport.model_validate(
        {
            "from": start,
            "to": end,
            "totals": UsageBlock(**_block_fields(in_range.values())),
            "byCountry": by_country,
            "weekly": weekly,
            "sources": UsageSources(
                server=["upload", "validation", "analysis"], browser=["reports"]
            ),
        }
    )
