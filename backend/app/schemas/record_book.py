from pydantic import BaseModel


class RecordBookLeader(BaseModel):
    rank: int
    fighter: str
    value: str
    # The fighter's name in our catalog, when we have a profile for them (the page links these to the profile).
    profile_name: str | None = None
    ufc_url: str | None = None


class RecordBookStat(BaseModel):
    key: str
    title: str
    note: str | None = None
    unit: str
    leaders: list[RecordBookLeader]


class RecordBookCategory(BaseModel):
    name: str
    stats: list[RecordBookStat]


class RecordBookResponse(BaseModel):
    updated: str | None = None
    source_name: str
    source_url: str
    categories: list[RecordBookCategory]
