from fastapi import APIRouter, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.events import EventSummary
from backend.app.services.events_service import get_events, get_upcoming_events

router = APIRouter(tags=["events"])


@router.get("/events/upcoming", response_model=list[EventSummary])
@limiter.limit("60/minute")
def upcoming_events(request: Request, response: Response) -> list[EventSummary]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return [EventSummary(**event) for event in get_upcoming_events()]


@router.get("/events", response_model=list[EventSummary])
@limiter.limit("60/minute")
def events(request: Request, response: Response) -> list[EventSummary]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return [EventSummary(**event) for event in get_events()]
