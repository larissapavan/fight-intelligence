from fastapi import APIRouter, Query, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.news import NewsResponse
from backend.app.services.news_service import get_latest_news

router = APIRouter(tags=["news"])


@router.get("/news", response_model=NewsResponse)
@limiter.limit("60/minute")
def news(request: Request, response: Response, limit: int = Query(6, ge=1, le=12)) -> NewsResponse:
    response.headers["Cache-Control"] = "public, max-age=600"
    return NewsResponse(
        source_name="ESPN",
        source_url="https://www.espn.com/mma/",
        items=get_latest_news(limit),
    )
