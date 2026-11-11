from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.config import env
from app.modules.usage.aggregate import UsageReport, usage_report
from app.modules.usage.rollup import range_summaries

from .auth import require_admin

router = APIRouter()

DEFAULT_RANGE_DAYS = 30
MAX_RANGE_DAYS = 366
NOT_CONFIGURED = "Usage metrics aren't configured on this server"


class NotConfiguredResponse(BaseModel):
    detail: str


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


@router.get(
    "/usage",
    response_model=UsageReport,
    dependencies=[Depends(require_admin)],
    responses={503: {"model": NotConfiguredResponse}},
)
def get_usage(
    from_: date | None = Query(
        None, alias="from", description="First UTC day, included"
    ),
    to: date | None = Query(None, description="Last UTC day, included"),
) -> UsageReport:
    """
    Usage of the whole app, for any admin: every country's figures, whatever the
    session's country. The only admin route not limited to the session's country.

    `from` and `to` are UTC days, both included; without them, the 30 days ending
    today. A range over 366 days, or with `from` after `to`, gets 422. The `reports`
    figures are reported by the browser; the others are recorded by the server.
    Answers 503 when the server has no `USAGE_DIR`.
    """
    # Sync on purpose: it reads the event files and rollups on the share.
    if env.USAGE_DIR is None:
        raise HTTPException(status_code=503, detail=NOT_CONFIGURED)
    today = today_utc()
    if to is None:
        to = today
    if from_ is None:
        from_ = to - timedelta(days=DEFAULT_RANGE_DAYS - 1)
    if from_ > to:
        raise HTTPException(status_code=422, detail="`from` is after `to`")
    if (to - from_).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"The range can't be longer than {MAX_RANGE_DAYS} days",
        )
    return usage_report(range_summaries(env.USAGE_DIR, from_, to, today), from_, to)
