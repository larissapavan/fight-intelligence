from __future__ import annotations

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    fighter_a: str = Field(..., min_length=1, max_length=80)
    fighter_b: str = Field(..., min_length=1, max_length=80)


class MainFactor(BaseModel):
    feature: str
    impact: str
    explanation: str
    magnitude: float


class DataConfidence(BaseModel):
    """How much the prediction has to go on (fights on record, time since the last one, missing measurements)."""

    level: str  # "solid" | "some_gaps" | "thin"
    label: str
    reasons: list[str]


class PredictionResponse(BaseModel):
    predicted_winner: str
    probability: float
    fighter_a_probability: float
    fighter_b_probability: float
    message: str
    fighter_a_profile: dict
    fighter_b_profile: dict
    comparison_stats: dict
    main_factors: list[MainFactor]
    data_confidence: DataConfidence | None = None


class UpcomingPick(BaseModel):
    event_name: str
    event_date: str | None = None
    fighter_1: str
    fighter_2: str
    predicted_winner: str
    probability: float
    fighter_1_probability: float
    title_fight: bool | None = None
    bmf_title: bool = False
    interim_title: bool = False


class RoundRobinRow(BaseModel):
    fighter: str
    rank: int
    average_win_probability: float
    expected_wins: float


class DivisionMatrix(BaseModel):
    """Every ranked fighter of a division against every other, by the model: who would come out on top in a round robin."""

    category: str
    fighters: list[str]  # in ranking order; the rows and columns of `matrix`
    matrix: list[list[float | None]]  # matrix[i][j] = chance that fighters[i] beats fighters[j]; None on the diagonal
    round_robin: list[RoundRobinRow]  # best first
    skipped: list[str]  # ranked fighters the catalog has no profile for
