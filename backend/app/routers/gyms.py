from fastapi import APIRouter, HTTPException, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.gyms import GymDetail, GymSummary
from backend.app.services.gyms_service import get_gym, list_gyms

router = APIRouter(prefix="/gyms", tags=["gyms"])


@router.get("", response_model=list[GymSummary])
@limiter.limit("60/minute")
def gyms(request: Request, response: Response) -> list[GymSummary]:
    response.headers["Cache-Control"] = "public, max-age=900"
    return [GymSummary(**gym) for gym in list_gyms()]


@router.get("/{slug}", response_model=GymDetail)
@limiter.limit("60/minute")
def gym(request: Request, response: Response, slug: str) -> GymDetail:
    try:
        found = get_gym(slug)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    response.headers["Cache-Control"] = "public, max-age=900"
    return GymDetail(**found)
