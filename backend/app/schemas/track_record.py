from pydantic import BaseModel


class TrackedFight(BaseModel):
    event_name: str
    event_date: str
    fighter_1: str
    fighter_2: str
    predicted_winner: str
    confidence: float
    winner: str | None = None
    correct: bool


class ConfidenceBand(BaseModel):
    label: str
    fights: int
    average_confidence: float
    accuracy: float


class NextEvent(BaseModel):
    name: str
    date: str


class TrackRecordResponse(BaseModel):
    tracking_since: str | None = None
    logged: int
    resolved: int
    correct: int
    accuracy: float | None = None
    average_confidence: float | None = None
    pending: int
    earlier_model_picks: int = 0
    earlier_model_note: str | None = None
    next_event: NextEvent | None = None
    bands: list[ConfidenceBand]
    recent: list[TrackedFight]
    biggest_misses: list[TrackedFight]
