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
    winner: str | None = None
    location: str | None = None
    fight_url: str | None = None
    referee: str | None = None
    num_rounds: int | None = None
    title_fight: bool | None = None
    bmf_title: bool = False
    outcome: str | None = None
    result_details: str | None = None


class CommonOpponent(BaseModel):
    opponent: str
    fighter_a_result: str | None = None
    fighter_b_result: str | None = None


class Opponent(BaseModel):
    name: str
    fights: int
    last_date: str | None = None


class OpponentsResponse(BaseModel):
    fighter: str
    opponents: list[Opponent]


class HeadToHeadResponse(BaseModel):
    fighter_a: str
    fighter_b: str
    fighter_a_wins: int
    fighter_b_wins: int
    no_contests: int
    meetings: list[FightRecord]
    common_opponents: list[CommonOpponent]
    network_path: list[str]
    degrees_of_separation: int | None = None


class YearlyTrend(BaseModel):
    year: int
    fights: int
    wins: int
    losses: int
    win_rate: float | None = None
    finish_rate: float | None = None
    avg_win_time_seconds: int | None = None
    round_distribution: dict[int, int]


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
    career_timeline: list[FightRecord]
    yearly_trends: list[YearlyTrend]
