from typing import Literal

from pydantic import BaseModel


class LastFight(BaseModel):
    event: str | None = None
    date: str | None = None
    opponent: str
    result: Literal["win", "loss"] | None = None
    method: str | None = None
    round: int | None = None
    time: str | None = None


class TitleReign(BaseModel):
    division: str
    title_type: Literal["undisputed", "interim"]
    champion: str
    fighter_url: str | None = None
    fighter_reign_index: int
    won_how: str | None = None
    opponent_beaten: str | None = None
    event: str | None = None
    location: str | None = None
    date_won: str | None = None
    days_held: int | None = None
    is_current: bool
    defenses_count: int
    defenses_detail: str | None = None
    end_reason: str
    last_fight: LastFight | None = None


class ChampionSummary(BaseModel):
    champion: str
    fighter_url: str | None = None
    divisions: list[str]
    total_reigns: int
    total_defenses: int
    total_days_as_champion: int
    longest_reign_days: int
    is_current_champion: bool


class TitleWin(BaseModel):
    """How a champion first won the belt in one division, and what they did with it."""

    division: str
    title_type: Literal["undisputed", "interim"]
    opponent: str | None = None
    event: str | None = None
    date: str | None = None
    method: str | None = None
    round: int | None = None
    won_how: str | None = None
    defenses: int
    reigns_in_division: int


class TitleFight(BaseModel):
    """One championship bout in a fighter's career, labelled by what it meant for them."""

    date: str | None = None
    event: str | None = None
    division: str | None = None
    opponent: str
    result: Literal["win", "loss", "draw", "no_contest"]
    role: Literal["won_title", "defense", "lost_title", "challenge", "other"]
    label: str
    title_type: Literal["undisputed", "interim"] | None = None
    method: str | None = None
    round: int | None = None


class RecordEntry(BaseModel):
    rank: int
    champion: str
    fighter_url: str | None = None
    division: str | None = None
    value: int
    detail: str | None = None
    title_wins: list[TitleWin] | None = None
    title_fights: list[TitleFight] | None = None


class RecordCategory(BaseModel):
    key: str
    label: str
    kind: Literal["positive", "negative"]
    unit: str
    entries: list[RecordEntry]


class ChampionsResponse(BaseModel):
    current_champions: list[TitleReign]
    reigns: list[TitleReign] = []
    greatest_champions: list[ChampionSummary]
    records: list[RecordCategory]
