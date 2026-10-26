from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

StanceType = Literal["Orthodox", "Southpaw", "Switch", "Open Stance", "Unknown"]


class Nationality(BaseModel):
    name: str
    code: str | None = None


class UpcomingBout(BaseModel):
    event_name: str
    event_date: str
    location: str | None = None
    opponent: str
    weight_class: str | None = None
    title_fight: bool = False
    interim_title: bool = False
    bmf_title: bool = False
    is_main_event: bool = False
    event_url: str | None = None


class FighterSummary(BaseModel):
    name: str
    is_active: bool = False
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
    hometown: str | None = None
    country: str | None = None
    country_code: str | None = None
    ufc_status: Literal["active", "former", "never"] = "never"
    ufc_debut: str | None = None
    ufc_last_fight: str | None = None
    roster_url: str | None = None
    badges: list[str] = []
    current_titles: list[str] = []
    former_titles: list[str] = []
    interim_titles: list[str] = []
    nationalities: list[Nationality] = []
    elo: int | None = None
    peak_elo: int | None = None
    elo_rank: int | None = None
    next_fight: UpcomingBout | None = None
    upcoming_fights: list[UpcomingBout] = []
