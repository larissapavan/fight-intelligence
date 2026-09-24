from pydantic import BaseModel


class RankingEntry(BaseModel):
    rank: int
    fighter: str
    rank_change: str | None = None
    win_rate: float | None = None
    last_fight: str | None = None
    athlete_url: str | None = None


class RankingCategory(BaseModel):
    category: str
    is_p4p: bool
    entries: list[RankingEntry]
