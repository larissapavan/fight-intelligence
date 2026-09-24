from pydantic import BaseModel


class FightResult(BaseModel):
    fighter_1: str
    fighter_2: str
    winner: str | None = None
    weight_class: str | None = None
    method: str | None = None
    method_detail: str | None = None
    round: int | None = None
    time: str | None = None
    fight_url: str | None = None


class EventSummary(BaseModel):
    name: str
    date: str | None = None
    location: str | None = None
    fight_count: int
    fights: list[FightResult]
    event_url: str | None = None
