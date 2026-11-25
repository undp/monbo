"""Usage events: what is recorded about each upload, validation, analysis and report.

An event holds a timestamp, its type, outcome and source, the session, country and
module, and counts. Never farm data: no IDs, producers, coordinates, geometries, file
names, request bodies, IP addresses or user agents (spec "Events never carry farm
data"). `extra="forbid"` keeps it that way.
"""

import json
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.maps import COUNTRY_CODE_PATTERN

ServerEventType = Literal["upload", "validation", "analysis"]
BrowserEventType = Literal["report_requested", "report_downloaded"]
ServerOutcome = Literal["ok", "invalid_input", "server_error"]
BrowserOutcome = Literal["ok", "error"]
UploadModule = Literal["polygons-validation", "deforestation-analysis"]
ReportFormat = Literal["pdf", "zip"]

SERVER_EVENT_TYPES: tuple[str, ...] = ("upload", "validation", "analysis")
SERVER_OUTCOMES: tuple[str, ...] = ("ok", "invalid_input", "server_error")
BROWSER_OUTCOMES: tuple[str, ...] = ("ok", "error")

Count = Annotated[int, Field(ge=0)]
CountryCode = Annotated[str, StringConstraints(pattern=COUNTRY_CODE_PATTERN)]
MAX_EVENT_FARMS = 100_000


class UsageEvent(BaseModel):
    """One line of an event file."""

    model_config = ConfigDict(extra="forbid")

    v: Literal[1] = 1
    at: datetime
    type: ServerEventType | BrowserEventType
    outcome: ServerOutcome | BrowserOutcome
    source: Literal["server", "browser"]
    session: UUID | None = None
    country: CountryCode | None = None
    module: UploadModule | None = None
    farms: Count | None = None
    polygons: Count | None = None
    points: Count | None = None
    invalidFarms: Count | None = None
    maps: Count | None = None
    format: ReportFormat | None = None

    @model_validator(mode="after")
    def _source_matches_type(self) -> "UsageEvent":
        server = self.type in SERVER_EVENT_TYPES
        if server != (self.source == "server"):
            raise ValueError(f"a {self.type} event can't come from the {self.source}")
        if self.outcome not in (SERVER_OUTCOMES if server else BROWSER_OUTCOMES):
            raise ValueError(f"a {self.type} event can't have outcome {self.outcome}")
        return self

    def to_line(self) -> str:
        """The event as one JSON line, without a newline. Session and country are
        always written (null when unknown); absent counts are left out."""
        data = self.model_dump(mode="json", exclude_none=True)
        data["session"] = data.get("session")
        data["country"] = data.get("country")
        data["at"] = (
            self.at.astimezone(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
        )
        return json.dumps(data, separators=(",", ":"), ensure_ascii=False)


class BrowserEventBody(BaseModel):
    """Body of `POST /events`: one event reported by the browser."""

    model_config = ConfigDict(extra="forbid")

    type: BrowserEventType
    outcome: BrowserOutcome
    session: UUID | None = None
    country: CountryCode | None = None
    farms: Annotated[int, Field(ge=0, le=MAX_EVENT_FARMS)]
    format: ReportFormat | None = Field(
        default=None,
        description="`pdf` (one PDF) or `zip` (one PDF per farm). Required for "
        "`report_downloaded`, absent otherwise.",
    )

    @model_validator(mode="after")
    def _format_only_on_downloads(self) -> "BrowserEventBody":
        if self.type == "report_downloaded" and self.format is None:
            raise ValueError("report_downloaded requires a format")
        if self.type != "report_downloaded" and self.format is not None:
            raise ValueError(f"{self.type} takes no format")
        return self
