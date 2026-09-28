from fastapi import APIRouter, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.champions import ChampionsResponse
from backend.app.services.champions_service import get_champions_data

router = APIRouter(tags=["champions"])


@router.get("/champions", response_model=ChampionsResponse)
@limiter.limit("60/minute")
def champions(request: Request, response: Response) -> ChampionsResponse:
    response.headers["Cache-Control"] = "public, max-age=3600"
    return ChampionsResponse(**get_champions_data())
