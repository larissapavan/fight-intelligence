from fastapi import APIRouter, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.track_record import TrackRecordResponse
from backend.app.services.auto_settle_service import sync_and_settle
from backend.app.services.track_record_service import get_track_record

router = APIRouter(tags=["track-record"])


@router.get("/track-record", response_model=TrackRecordResponse)
@limiter.limit("60/minute")
def track_record(request: Request, response: Response) -> TrackRecordResponse:
    response.headers["Cache-Control"] = "public, max-age=600"
    return TrackRecordResponse(**get_track_record())


@router.post("/track-record/sync")
@limiter.limit("20/minute")
def sync_track_record(request: Request) -> dict:
    return sync_and_settle()
