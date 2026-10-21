from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.data_info import DataInfoResponse
from backend.app.schemas.fight_history import FightRecord
from backend.app.schemas.orgs import OrgEvent, OrgFighter, OrgInfo, OrgRankingCategory
from backend.app.services.org_service import (
    get_org,
    get_org_data_info,
    get_org_events,
    get_org_fighter_fights,
    get_org_fighters,
    get_org_rankings,
    get_org_upcoming_events,
    list_orgs,
)

router = APIRouter(prefix="/orgs", tags=["organisations"])


def _known_org(org_id: str) -> str:
    try:
        return get_org(org_id).id
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("", response_model=list[OrgInfo])
@limiter.limit("60/minute")
def organisations(request: Request, response: Response) -> list[OrgInfo]:
    """The organisations served by the generic endpoints below (the UFC keeps its own, older endpoints)."""
    response.headers["Cache-Control"] = "public, max-age=3600"
    return [
        OrgInfo(id=org.id, name=org.name, short_name=org.short_name, tagline=org.tagline, sources=list(org.sources))
        for org in list_orgs()
    ]


@router.get("/{org_id}/fighters", response_model=list[OrgFighter])
@limiter.limit("60/minute")
def org_fighters(
    request: Request,
    response: Response,
    org_id: str,
    limit: int | None = Query(default=None, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
) -> list[OrgFighter]:
    fighters = get_org_fighters(_known_org(org_id))
    response.headers["Cache-Control"] = "public, max-age=300"
    response.headers["X-Total-Count"] = str(len(fighters))
    page = fighters[offset : offset + limit] if limit is not None else fighters[offset:]
    return [OrgFighter(**fighter) for fighter in page]


@router.get("/{org_id}/fighters/{name}/fights", response_model=list[FightRecord])
@limiter.limit("60/minute")
def org_fighter_fights(request: Request, response: Response, org_id: str, name: str) -> list[FightRecord]:
    org = _known_org(org_id)
    try:
        fights = get_org_fighter_fights(org, name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    response.headers["Cache-Control"] = "public, max-age=300"
    return [FightRecord(**fight) for fight in fights]


@router.get("/{org_id}/events", response_model=list[OrgEvent])
@limiter.limit("60/minute")
def org_events(request: Request, response: Response, org_id: str) -> list[OrgEvent]:
    events = get_org_events(_known_org(org_id))
    response.headers["Cache-Control"] = "public, max-age=300"
    return [OrgEvent(**event) for event in events]


@router.get("/{org_id}/events/upcoming", response_model=list[OrgEvent])
@limiter.limit("60/minute")
def org_upcoming_events(request: Request, response: Response, org_id: str) -> list[OrgEvent]:
    events = get_org_upcoming_events(_known_org(org_id))
    response.headers["Cache-Control"] = "public, max-age=300"
    return [OrgEvent(**event) for event in events]


@router.get("/{org_id}/rankings", response_model=list[OrgRankingCategory])
@limiter.limit("60/minute")
def org_rankings(request: Request, response: Response, org_id: str) -> list[OrgRankingCategory]:
    rankings = get_org_rankings(_known_org(org_id))
    response.headers["Cache-Control"] = "public, max-age=1800"
    return [OrgRankingCategory(**category) for category in rankings]


@router.get("/{org_id}/data-info", response_model=DataInfoResponse)
@limiter.limit("60/minute")
def org_data_info(request: Request, response: Response, org_id: str) -> DataInfoResponse:
    info = get_org_data_info(_known_org(org_id))
    response.headers["Cache-Control"] = "public, max-age=300"
    return DataInfoResponse(**info)
