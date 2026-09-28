from typing import Literal

from pydantic import BaseModel


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


class ChampionSummary(BaseModel):
    champion: str
    fighter_url: str | None = None
    divisions: list[str]
    total_reigns: int
    total_defenses: int
    total_days_as_champion: int
    longest_reign_days: int
    is_current_champion: bool


class RecordEntry(BaseModel):
    rank: int
    champion: str
    fighter_url: str | None = None
    division: str | None = None
    value: int
    detail: str | None = None


class RecordCategory(BaseModel):
    key: str
    label: str
    kind: Literal["positive", "negative"]
    unit: str
    entries: list[RecordEntry]


class ChampionsResponse(BaseModel):
    current_champions: list[TitleReign]
    greatest_champions: list[ChampionSummary]
    records: list[RecordCategory]
