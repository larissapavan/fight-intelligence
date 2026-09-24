from __future__ import annotations

import pandas as pd

from backend.app.services.catalog_service import _normalize_name, get_fighter_catalog
from src.ufc_predictor.config import RAW_DATA_DIR

RANKINGS_SOURCE_PATH = RAW_DATA_DIR / "rankings.csv"
EVENT_CARDS_SOURCE_PATH = RAW_DATA_DIR / "event_cards.csv"


_cache: dict = {"signature": None, "data": None}


def _source_signature() -> tuple:
    paths = [RANKINGS_SOURCE_PATH, EVENT_CARDS_SOURCE_PATH]
    return tuple(path.stat().st_mtime_ns if path.exists() else None for path in paths)


def get_rankings() -> list[dict]:
    """Official UFC divisional + pound-for-pound rankings, enriched with our
    own win rate / last-fight data. Rebuilds automatically when either
    source CSV changes (rankings.csv is re-scraped occasionally; event_cards
    updates keep last_fight current)."""

    signature = _source_signature()
    if _cache["signature"] != signature:
        _cache["data"] = _build_rankings()
        _cache["signature"] = signature
    return _cache["data"]


def _build_rankings() -> list[dict]:
    if not RANKINGS_SOURCE_PATH.exists():
        return []

    rankings_df = pd.read_csv(RANKINGS_SOURCE_PATH)
    win_rate_by_name = _win_rate_by_normalized_name()
    last_fight_by_name = _last_fight_by_normalized_name()

    categories: list[dict] = []
    for category, group in rankings_df.groupby("category", sort=False):
        is_p4p = bool(group["is_p4p"].iloc[0])
        entries = []
        for _, row in group.sort_values("rank").iterrows():
            key = _normalize_name(row["fighter"])
            entries.append(
                {
                    "rank": int(row["rank"]),
                    "fighter": row["fighter"],
                    "rank_change": _nullable_string(row.get("rank_change")),
                    "win_rate": win_rate_by_name.get(key),
                    "last_fight": last_fight_by_name.get(key),
                    "athlete_url": _nullable_string(row.get("athlete_url")),
                }
            )
        categories.append({"category": category, "is_p4p": is_p4p, "entries": entries})

    # Keep P4P first, then divisions in the order ufc.com lists them.
    categories.sort(key=lambda item: (not item["is_p4p"], item["category"]))
    return categories


def _win_rate_by_normalized_name() -> dict[str, float]:
    catalog = get_fighter_catalog()
    return {
        _normalize_name(row["name"]): float(row["win_rate"])
        for row in catalog.to_dict(orient="records")
        if pd.notna(row.get("win_rate"))
    }


def _last_fight_by_normalized_name() -> dict[str, str]:
    if not EVENT_CARDS_SOURCE_PATH.exists():
        return {}

    fights_df = pd.read_csv(EVENT_CARDS_SOURCE_PATH, usecols=["event_date", "fighter_1", "fighter_2"])
    fights_df["event_date_parsed"] = pd.to_datetime(fights_df["event_date"], format="%B %d, %Y", errors="coerce")

    first_view = fights_df[["event_date_parsed", "fighter_1"]].rename(columns={"fighter_1": "name"})
    second_view = fights_df[["event_date_parsed", "fighter_2"]].rename(columns={"fighter_2": "name"})
    history = pd.concat([first_view, second_view], ignore_index=True).dropna(subset=["name", "event_date_parsed"])
    history["key"] = history["name"].apply(_normalize_name)

    latest = history.groupby("key")["event_date_parsed"].max()
    return {key: date.date().isoformat() for key, date in latest.items()}


def _nullable_string(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None
