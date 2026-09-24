from pydantic import BaseModel


class FightRecord(BaseModel):
    event_name: str
    date: str | None = None
    opponent: str
    result: str | None = None
    weight_class: str | None = None
    method: str | None = None
    method_detail: str | None = None
    round: int | None = None
    time: str | None = None


class HeadToHeadResponse(BaseModel):
    fighter_a: str
    fighter_b: str
    fighter_a_wins: int
    fighter_b_wins: int
    no_contests: int
    meetings: list[FightRecord]


class FighterPerformance(BaseModel):
    fighter: str
    total_fights: int
    wins: int
    losses: int
    method_breakdown: dict[str, int]
    round_distribution: dict[int, int]
    avg_win_time_seconds: int | None = None
    weight_class_history: list[str]
    last_performances: list[FightRecord]
