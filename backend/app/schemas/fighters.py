from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

StanceType = Literal["Orthodox", "Southpaw", "Switch", "Open Stance", "Unknown"]


class FighterSummary(BaseModel):
    name: str
    nickname: str | None = None
    age: float | None = None
    height_cm: float | None = None
    weight_lbs: float | None = None
    reach_cm: float | None = None
    wins: int | None = None
    losses: int | None = None
    draws: int | None = None
    total_fights: int | None = None
    win_rate: float | None = None
    sig_str_acc: float | None = None
    takedown_acc: float | None = None
    sig_strikes_landed_per_min: float | None = None
    sig_strikes_absorbed_per_min: float | None = None
    striking_defense: float | None = None
    takedown_avg_per_15min: float | None = None
    takedown_defense: float | None = None
    submission_avg_per_15min: float | None = None
    stance: StanceType = "Unknown"
    division: str | None = None
    belt: bool = False
    ranking: str | None = None
    rank_signal: str | None = None
    image_url: str | None = None
    fighter_url: str | None = None
