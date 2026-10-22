"""How much a prediction has to go on, apart from the probability itself.

The model gives a number for any two fighters, but a fighter with two fights, or one who has been out for two years,
or one with no reach on record, is a far shakier input than a veteran who fought last spring. This reads the two
profiles and says so in plain words, so a 70% built on thin data is not read like a 70% built on a full career.
"""

from __future__ import annotations

from datetime import date

import pandas as pd

VERY_FEW_FIGHTS = 4
FEW_FIGHTS = 8
LONG_LAYOFF_DAYS = 365
VERY_LONG_LAYOFF_DAYS = 730
THIN_POINTS = 3  # at this many points the prediction is called thin
LABELS = {"solid": "Solid data", "some_gaps": "Some gaps in the data", "thin": "Thin data"}


def _layoff_days(profile: dict, today: date) -> int | None:
    last = pd.to_datetime(profile.get("ufc_last_fight"), errors="coerce")
    if pd.isna(last):
        return None
    return max((today - last.date()).days, 0)


def _duration(days: int) -> str:
    years, months = divmod(days // 30, 12)
    if years:
        return f"{years} year{'s' if years > 1 else ''}"
    return f"{max(months, 1)} month{'s' if months > 1 else ''}"


def _fighter_issues(profile: dict, today: date) -> tuple[int, list[str]]:
    name = profile["name"]
    points, reasons = 0, []

    fights = int(profile.get("total_fights") or 0)
    if fights < VERY_FEW_FIGHTS:
        points += 2
        reasons.append(f"{name} has only {fights} recorded fight{'s' if fights != 1 else ''}, so their numbers are not settled yet.")
    elif fights < FEW_FIGHTS:
        points += 1
        reasons.append(f"{name} has only {fights} recorded fights.")

    layoff = _layoff_days(profile, today)
    if layoff is not None and layoff >= LONG_LAYOFF_DAYS:
        points += 2 if layoff >= VERY_LONG_LAYOFF_DAYS else 1
        reasons.append(f"{name} last fought in the UFC about {_duration(layoff)} ago; the model sees no sign of ring rust.")

    missing = [label for key, label in (("age", "age"), ("height_cm", "height"), ("reach_cm", "reach")) if profile.get(key) is None]
    if missing:
        points += 1
        reasons.append(f"{name} has no {' or '.join(missing)} on record, so the model filled it in with an average.")
    return points, reasons


def assess(fighter_a: dict, fighter_b: dict, today: date | None = None) -> dict:
    """{"level": "solid" | "some_gaps" | "thin", "label": ..., "reasons": [...]} for a matchup."""
    today = today or date.today()
    points, reasons = 0, []
    for profile in (fighter_a, fighter_b):
        fighter_points, fighter_reasons = _fighter_issues(profile, today)
        points += fighter_points
        reasons += fighter_reasons
    level = "solid" if points == 0 else "thin" if points >= THIN_POINTS else "some_gaps"
    return {"level": level, "label": LABELS[level], "reasons": reasons}
