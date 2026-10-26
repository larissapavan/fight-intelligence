from fastapi import APIRouter, Query, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.rankings import RankingCategory
from backend.app.services.elo_service import get_elo_leaderboard
from backend.app.services.rankings_service import get_rankings

router = APIRouter(tags=["rankings"])


@router.get("/rankings", response_model=list[RankingCategory])
@limiter.limit("60/minute")
def rankings(request: Request, response: Response) -> list[RankingCategory]:
    response.headers["Cache-Control"] = "public, max-age=1800"
    return [RankingCategory(**category) for category in get_rankings()]


@router.get("/rankings/elo")
@limiter.limit("60/minute")
def elo_rankings(
    request: Request,
    response: Response,
    division: str | None = Query(default=None, description="Filter by weight class or division."),
    active_only: bool = Query(default=True, description="Filter for active fighters only."),
    limit: int = Query(default=50, ge=1, le=200, description="Max number of ranked fighters."),
) -> list[dict]:
    response.headers["Cache-Control"] = "public, max-age=600"
    return get_elo_leaderboard(division=division, active_only=active_only, limit=limit)
