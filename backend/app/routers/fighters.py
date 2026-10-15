from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.fighters import FighterSummary
from backend.app.schemas.similarity import SimilarFighter
from backend.app.services.catalog_service import get_fighter_profile, list_fighters
from backend.app.services.similarity_service import get_similar_fighters

router = APIRouter(tags=["fighters"])


@router.get("/fighters", response_model=list[FighterSummary])
@limiter.limit("60/minute")
def fighters(
    request: Request,
    response: Response,
    limit: int | None = Query(default=None, ge=1, le=5000, description="Max number of fighters to return."),
    offset: int = Query(default=0, ge=0, description="Number of fighters to skip."),
    ufc_only: bool = Query(default=False, description="Leave out fighters who never fought in the UFC."),
) -> list[FighterSummary]:
    response.headers["Cache-Control"] = "public, max-age=300"
    catalog = list_fighters(ufc_only=ufc_only)
    response.headers["X-Total-Count"] = str(len(catalog))
    page = catalog[offset : offset + limit] if limit is not None else catalog[offset:]
    return [FighterSummary(**fighter) for fighter in page]


@router.get("/fighters/{name}/similar", response_model=list[SimilarFighter])
@limiter.limit("60/minute")
def similar_fighters(
    request: Request,
    response: Response,
    name: str,
    limit: int = Query(default=5, ge=1, le=20, description="Max number of similar fighters to return."),
) -> list[SimilarFighter]:
    try:
        get_fighter_profile(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    response.headers["Cache-Control"] = "public, max-age=300"
    return [SimilarFighter(**fighter) for fighter in get_similar_fighters(name, limit=limit)]
