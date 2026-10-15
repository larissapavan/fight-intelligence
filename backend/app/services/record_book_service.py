from __future__ import annotations

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

from .catalog_service import _normalize_name, get_fighter_catalog

STAT_LEADERS_SOURCE_PATH = RAW_DATA_DIR / "stat_leaders.csv"
SOURCE_NAME = "UFC Stats Leaders (Record Book)"
SOURCE_URL = "https://statleaders.ufc.com/en/career"
CATEGORY_ORDER = ["Fights", "Time", "Striking", "Grappling"]

_cache: dict = {"signature": None, "data": None}


def _signature() -> tuple | None:
    if not STAT_LEADERS_SOURCE_PATH.exists():
        return None
    return (STAT_LEADERS_SOURCE_PATH.stat().st_mtime_ns,)


def get_record_book() -> dict:
    """The UFC's career record book (data/raw/stat_leaders.csv), grouped by category and stat."""
    signature = _signature()
    if _cache["signature"] != signature or _cache["data"] is None:
        _cache.update({"signature": signature, "data": _build()})
    return _cache["data"]


def _build() -> dict:
    empty = {"updated": None, "source_name": SOURCE_NAME, "source_url": SOURCE_URL, "categories": []}
    if not STAT_LEADERS_SOURCE_PATH.exists():
        return empty
    leaders = pd.read_csv(STAT_LEADERS_SOURCE_PATH, dtype=str, keep_default_na=False)
    if leaders.empty:
        return empty

    catalog_names = {_normalize_name(name): name for name in get_fighter_catalog()["name"]}
    categories: dict[str, dict[str, dict]] = {}
    for row in leaders.to_dict(orient="records"):
        stats = categories.setdefault(row["category"], {})
        stat = stats.setdefault(
            row["stat_key"],
            {"key": row["stat_key"], "title": row["stat"], "note": row["note"] or None, "unit": row["unit"], "leaders": []},
        )
        stat["leaders"].append(
            {
                "rank": int(row["rank"]),
                "fighter": row["fighter"],
                "value": row["value"],
                "profile_name": catalog_names.get(_normalize_name(row["fighter"])),
                "ufc_url": row["ufc_url"] or None,
            }
        )

    ordered = sorted(categories, key=lambda name: CATEGORY_ORDER.index(name) if name in CATEGORY_ORDER else len(CATEGORY_ORDER))
    return {
        "updated": next((value for value in leaders["updated"] if value), None),
        "source_name": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "categories": [{"name": name, "stats": list(categories[name].values())} for name in ordered],
    }
