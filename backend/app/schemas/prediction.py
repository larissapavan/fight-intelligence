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
