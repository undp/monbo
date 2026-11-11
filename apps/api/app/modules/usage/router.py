from fastapi import APIRouter, Response

from .models import BrowserEventBody, UsageEvent
from .writer import now, record

router = APIRouter()


@router.post("", status_code=204, response_class=Response)
def report_event(body: BrowserEventBody) -> Response:
    """
    Records a usage event reported by the browser: a click on "Generate report"
    (`report_requested`) or a finished report download (`report_downloaded`, as one
    PDF or as a ZIP of one PDF per farm).

    Public, with no rate limit, so these figures are labelled "reported by the
    browser" in the admin. The server stamps the time. Bodies over 2048 bytes
    get 413, unknown types and extra fields 422.
    """
    # Sync on purpose: recording appends to a file on the share.
    record(
        UsageEvent.model_validate(
            {**body.model_dump(), "at": now(), "source": "browser"}
        )
    )
    return Response(status_code=204)
