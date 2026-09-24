from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.fight_history import FighterPerformance, HeadToHeadResponse
from backend.app.services.catalog_service import get_fighter_profile
from backend.app.services.fight_history_service import get_fighter_performance, get_head_to_head

router = APIRouter(tags=["fight-history"])


@router.get("/head-to-head", response_model=HeadToHeadResponse)
@limiter.limit("60/minute")
def head_to_head(
    request: Request,
    response: Response,
    fighter_a: str = Query(..., min_length=1, max_length=80),
    fighter_b: str = Query(..., min_length=1, max_length=80),
) -> HeadToHeadResponse:
    # Validate both names exist in the catalog before searching fight history,
    # so a typo returns a clear 404 instead of a silent "0 meetings" result.
    try:
        get_fighter_profile(fighter_a)
        get_fighter_profile(fighter_b)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    response.headers["Cache-Control"] = "public, max-age=300"
    return HeadToHeadResponse(**get_head_to_head(fighter_a, fighter_b))


@router.get("/fighters/{name}/performance", response_model=FighterPerformance)
@limiter.limit("60/minute")
def fighter_performance(request: Request, response: Response, name: str) -> FighterPerformance:
    try:
        get_fighter_profile(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    response.headers["Cache-Control"] = "public, max-age=300"
    return FighterPerformance(**get_fighter_performance(name))
