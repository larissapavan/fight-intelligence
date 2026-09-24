from __future__ import annotations

import math

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

EVENT_CARDS_SOURCE_PATH = RAW_DATA_DIR / "event_cards.csv"
UPCOMING_EVENTS_SOURCE_PATH = RAW_DATA_DIR / "upcoming_events.csv"


def _load_event_cards(source_path) -> pd.DataFrame:
    if not source_path.exists():
        return pd.DataFrame(columns=["event_name", "event_date", "location", "event_url"])

    df = pd.read_csv(source_path)
    df["event_date_parsed"] = pd.to_datetime(df["event_date"], format="%B %d, %Y", errors="coerce")
    return df


_events_cache: dict = {"signature": None, "data": None}
_upcoming_cache: dict = {"signature": None, "data": None}


def _source_signature(source_path) -> float | None:
    if not source_path.exists():
        return None
    return source_path.stat().st_mtime_ns


def _build_events(source_path, *, ascending: bool) -> list[dict]:
    df = _load_event_cards(source_path)
    if df.empty:
        return []

    events: list[dict] = []
    for event_url, group in df.groupby("event_url", sort=False):
        first = group.iloc[0]
        date_parsed = first["event_date_parsed"]
        events.append(
            {
                "name": first["event_name"],
                "date": date_parsed.date().isoformat() if pd.notna(date_parsed) else None,
                "_sort_date": date_parsed if pd.notna(date_parsed) else pd.Timestamp.min,
                "location": _nullable_string(first.get("location")),
                "fight_count": int(group["fight_url"].notna().sum()),
                "fights": [_format_fight(row) for _, row in group.iterrows() if pd.notna(row.get("fight_url"))],
                "event_url": _nullable_string(event_url),
            }
        )

    events.sort(key=lambda event: event["_sort_date"], reverse=not ascending)
    for event in events:
        del event["_sort_date"]
    return events


def get_events() -> list[dict]:
    """Return every past event with its full fight card, most recent first.

    Rebuilds automatically when data/raw/event_cards.csv changes (the
    scraper appends to it while this service may already be running), same
    pattern as catalog_service.get_fighter_catalog().
    """

    signature = _source_signature(EVENT_CARDS_SOURCE_PATH)
    if _events_cache["signature"] != signature:
        _events_cache["data"] = _build_events(EVENT_CARDS_SOURCE_PATH, ascending=False)
        _events_cache["signature"] = signature
    return _events_cache["data"]


def get_upcoming_events() -> list[dict]:
    """Return scheduled-but-not-yet-fought events, soonest first.

    Every fight in these events has winner=None since they haven't happened
    yet; fight cards can also be partially announced (main event locked in,
    undercard still filling out), matching ufcstats.com itself.
    """

    signature = _source_signature(UPCOMING_EVENTS_SOURCE_PATH)
    if _upcoming_cache["signature"] != signature:
        _upcoming_cache["data"] = _build_events(UPCOMING_EVENTS_SOURCE_PATH, ascending=True)
        _upcoming_cache["signature"] = signature
    return _upcoming_cache["data"]


def _format_fight(row: pd.Series) -> dict:
    return {
        "fighter_1": row["fighter_1"],
        "fighter_2": row["fighter_2"],
        "winner": _nullable_string(row.get("winner")),
        "weight_class": _nullable_string(row.get("weight_class")),
        "method": _nullable_string(row.get("method")),
        "method_detail": _nullable_string(row.get("method_detail")),
        "round": _to_int(row.get("round")),
        "time": _nullable_string(row.get("time")),
        "fight_url": _nullable_string(row.get("fight_url")),
    }


def _nullable_string(value) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)) or pd.isna(value):
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
