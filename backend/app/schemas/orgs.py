from __future__ import annotations

from pydantic import BaseModel

from backend.app.schemas.events import EventSummary, FightResult
from backend.app.schemas.rankings import RankingCategory, RankingEntry


class OrgInfo(BaseModel):
    id: str
    name: str
    short_name: str
    tagline: str
    sources: list[str]


class NextFight(BaseModel):
    event: str
    date: str | None = None
    opponent: str


class OrgFighter(BaseModel):
    """A fighter of an organisation other than the UFC (data/raw/<org>/fighters.csv)."""

    name: str
    nickname: str | None = None
    is_active: bool = False
    age: float | None = None
    height_cm: float | None = None
    weight_lbs: float | None = None
    reach_cm: float | None = None
    leg_reach_cm: float | None = None
    wins: int | None = None
    losses: int | None = None
    draws: int | None = None
    no_contests: int | None = None
    total_fights: int | None = None
    win_rate: float | None = None
    division: str | None = None
    belt: bool = False
    title_status: str | None = None
    ranking: str | None = None
    image_url: str | None = None
    profile_url: str | None = None
    hometown: str | None = None
    country: str | None = None
    country_code: str | None = None
    camp: str | None = None
    fighting_out_of: str | None = None
    circuit: str | None = None
    org_record: str | None = None
    org_fights: int = 0
    first_fight_date: str | None = None
    last_fight_date: str | None = None
    next_fight: NextFight | None = None


class OrgFight(FightResult):
    stage: str | None = None


class OrgEvent(EventSummary):
    slug: str | None = None
    circuit: str | None = None
    fights: list[OrgFight]


class OrgRankingEntry(RankingEntry):
    status: str | None = None


class OrgRankingCategory(RankingCategory):
    entries: list[OrgRankingEntry]


__all__ = [
    "NextFight", "OrgEvent", "OrgFight", "OrgFighter", "OrgInfo", "OrgRankingCategory", "OrgRankingEntry", "RankingCategory",
]
