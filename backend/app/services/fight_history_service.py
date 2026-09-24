from __future__ import annotations

import pandas as pd

from backend.app.services.catalog_service import _normalize_name
from src.ufc_predictor.config import RAW_DATA_DIR

EVENT_CARDS_SOURCE_PATH = RAW_DATA_DIR / "event_cards.csv"

METHOD_BUCKETS = {
    "KO/TKO": "KO/TKO",
    "SUB": "Submission",
    "U-DEC": "Decision",
    "S-DEC": "Decision",
    "M-DEC": "Decision",
    "DQ": "Disqualification",
}

_cache: dict = {"signature": None, "data": None}


def _source_signature() -> int | None:
    if not EVENT_CARDS_SOURCE_PATH.exists():
        return None
    return EVENT_CARDS_SOURCE_PATH.stat().st_mtime_ns


def _load_fight_history() -> pd.DataFrame:
    signature = _source_signature()
    if _cache["signature"] != signature:
        if not EVENT_CARDS_SOURCE_PATH.exists():
            df = pd.DataFrame()
        else:
            df = pd.read_csv(EVENT_CARDS_SOURCE_PATH)
            df["event_date_parsed"] = pd.to_datetime(df["event_date"], format="%B %d, %Y", errors="coerce")
            df["key_1"] = df["fighter_1"].apply(_normalize_name)
            df["key_2"] = df["fighter_2"].apply(_normalize_name)
        _cache["data"] = df
        _cache["signature"] = signature
    return _cache["data"]


def get_fights_for_fighter(name: str) -> list[dict]:
    """All fights for one fighter, most recent first."""
    df = _load_fight_history()
    if df.empty:
        return []

    key = _normalize_name(name)
    rows = df[(df["key_1"] == key) | (df["key_2"] == key)]
    rows = rows.sort_values("event_date_parsed", ascending=False, na_position="last")

    fights: list[dict] = []
    for _, row in rows.iterrows():
        is_fighter_1 = row["key_1"] == key
        opponent_name = row["fighter_2"] if is_fighter_1 else row["fighter_1"]
        winner = row.get("winner")

        result = None
        if pd.notna(winner):
            result = "win" if _normalize_name(winner) == key else "loss"

        date_parsed = row["event_date_parsed"]
        fights.append(
            {
                "event_name": row["event_name"],
                "date": date_parsed.date().isoformat() if pd.notna(date_parsed) else None,
                "opponent": opponent_name,
                "result": result,
                "weight_class": _nullable(row.get("weight_class")),
                "method": _nullable(row.get("method")),
                "method_detail": _nullable(row.get("method_detail")),
                "round": _to_int(row.get("round")),
                "time": _nullable(row.get("time")),
            }
        )
    return fights


def get_head_to_head(fighter_a: str, fighter_b: str) -> dict:
    fights_a = get_fights_for_fighter(fighter_a)
    key_b = _normalize_name(fighter_b)
    meetings = [fight for fight in fights_a if _normalize_name(fight["opponent"]) == key_b]

    return {
        "fighter_a": fighter_a,
        "fighter_b": fighter_b,
        "fighter_a_wins": sum(1 for m in meetings if m["result"] == "win"),
        "fighter_b_wins": sum(1 for m in meetings if m["result"] == "loss"),
        "no_contests": sum(1 for m in meetings if m["result"] is None),
        "meetings": meetings,
    }


def get_fighter_performance(name: str) -> dict:
    fights = get_fights_for_fighter(name)
    wins = [fight for fight in fights if fight["result"] == "win"]
    losses = [fight for fight in fights if fight["result"] == "loss"]

    method_breakdown: dict[str, int] = {}
    for fight in wins:
        bucket = METHOD_BUCKETS.get(fight["method"] or "", "Other")
        method_breakdown[bucket] = method_breakdown.get(bucket, 0) + 1

    round_distribution: dict[int, int] = {}
    finish_seconds: list[int] = []
    for fight in wins:
        if fight["round"]:
            round_distribution[fight["round"]] = round_distribution.get(fight["round"], 0) + 1
        seconds = _time_to_seconds(fight["time"], fight["round"])
        if seconds is not None:
            finish_seconds.append(seconds)

    avg_win_seconds = round(sum(finish_seconds) / len(finish_seconds)) if finish_seconds else None

    weight_class_history: list[str] = []
    for fight in reversed(fights):  # oldest first
        weight_class = fight["weight_class"]
        if weight_class and (not weight_class_history or weight_class_history[-1] != weight_class):
            weight_class_history.append(weight_class)

    return {
        "fighter": name,
        "total_fights": len(fights),
        "wins": len(wins),
        "losses": len(losses),
        "method_breakdown": method_breakdown,
        "round_distribution": round_distribution,
        "avg_win_time_seconds": avg_win_seconds,
        "weight_class_history": weight_class_history,
        "last_performances": fights[:5],
    }


def _time_to_seconds(time_text: str | None, round_number: int | None) -> int | None:
    """Total fight-clock seconds elapsed at the finish (round-adjusted, 5-min rounds)."""
    if not time_text or ":" not in time_text:
        return None
    try:
        minutes, seconds = time_text.split(":")
        round_seconds = (int(round_number) - 1) * 5 * 60 if round_number else 0
        return round_seconds + int(minutes) * 60 + int(seconds)
    except ValueError:
        return None


def _nullable(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _to_int(value) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None
