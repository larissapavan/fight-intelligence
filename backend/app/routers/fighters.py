from fastapi import APIRouter, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.fighters import FighterSummary
from backend.app.services.catalog_service import list_fighters


router = APIRouter(tags=["fighters"])


@router.get("/fighters", response_model=list[FighterSummary])
@limiter.limit("60/minute")
def fighters(request: Request, response: Response) -> list[FighterSummary]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return [FighterSummary(**fighter) for fighter in list_fighters()]
