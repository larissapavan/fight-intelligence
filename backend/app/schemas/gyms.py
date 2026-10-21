from __future__ import annotations

from pydantic import BaseModel


class GymSummary(BaseModel):
    slug: str
    name: str
    url: str | None = None
    fighters_count: int
    # How many of the gym's fighters are in each organization's data here ({"ufc": 12, "pfl": 3}).
    orgs: dict[str, int] = {}
    champions: int = 0


class GymFighter(BaseModel):
    name: str
    nickname: str | None = None
    division: str | None = None
    country_code: str | None = None
    record: str | None = None
    # Organizations whose profile pages have this fighter, best known first.
    orgs: list[str] = []
    image_url: str | None = None
    belt: bool = False
    is_active: bool = False


class GymDetail(GymSummary):
    fighters: list[GymFighter]
