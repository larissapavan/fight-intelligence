from fastapi import APIRouter, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.rankings import RankingCategory
from backend.app.services.rankings_service import get_rankings

router = APIRouter(tags=["rankings"])


@router.get("/rankings", response_model=list[RankingCategory])
@limiter.limit("60/minute")
def rankings(request: Request, response: Response) -> list[RankingCategory]:
    response.headers["Cache-Control"] = "public, max-age=1800"
    return [RankingCategory(**category) for category in get_rankings()]
