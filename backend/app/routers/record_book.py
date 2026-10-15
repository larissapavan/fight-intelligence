from fastapi import APIRouter, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.record_book import RecordBookResponse
from backend.app.services.record_book_service import get_record_book

router = APIRouter(tags=["record-book"])


@router.get("/record-book", response_model=RecordBookResponse)
@limiter.limit("60/minute")
def record_book(request: Request, response: Response) -> RecordBookResponse:
    response.headers["Cache-Control"] = "public, max-age=3600"
    return RecordBookResponse(**get_record_book())
