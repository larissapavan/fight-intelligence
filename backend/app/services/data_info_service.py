from __future__ import annotations

from datetime import date

from backend.app.services.catalog_service import (
    HISTORICAL_PHOTOS_SOURCE_PATH,
    get_fighter_catalog,
    get_total_fights_tracked,
)
from backend.app.services.events_service import get_events
from src.ufc_predictor.config import RAW_DATA_DIR

DATA_SOURCES = [
    "ufcstats.com",
    "ufc.com",
    "pflmma.com",
    "onefc.com",
    "sherdog.com",
    "wikipedia.org",
    "tapology.com",
    "fighthub.net",
]

# Every raw dataset this app is built from — used only to find the most recent
# scrape/update timestamp, not to read their contents here.
TRACKED_SOURCE_FILES = [
    RAW_DATA_DIR / "fighters.csv",
    RAW_DATA_DIR / "fights.csv",
    RAW_DATA_DIR / "event_cards.csv",
    RAW_DATA_DIR / "fighter_career_stats.csv",
    RAW_DATA_DIR / "rankings.csv",
    RAW_DATA_DIR / "upcoming_events.csv",
    RAW_DATA_DIR / "pfl" / "fighters.csv",
    RAW_DATA_DIR / "pfl" / "fights.csv",
    RAW_DATA_DIR / "one" / "fighters.csv",
    RAW_DATA_DIR / "one" / "fights.csv",
    RAW_DATA_DIR / "bellator" / "fighters.csv",
    RAW_DATA_DIR / "bellator" / "fights.csv",
    HISTORICAL_PHOTOS_SOURCE_PATH,
]


def get_data_info() -> dict:
    catalog = get_fighter_catalog()
    events = get_events()

    timestamps = [path.stat().st_mtime for path in TRACKED_SOURCE_FILES if path.exists()]
    last_updated = date.fromtimestamp(max(timestamps)).isoformat() if timestamps else None

    total_fights = get_total_fights_tracked()
    total_fighters = len(catalog)
    total_events = len(events)

    for org_id in ("pfl", "one", "bellator"):
        try:
            from backend.app.services.org_service import get_org_fighters, get_org_events
            f_list = get_org_fighters(org_id)
            e_list = get_org_events(org_id)
            total_fighters += len(f_list)
            total_events += len(e_list)
            total_fights += sum(len(e.get("fights", [])) for e in e_list)
        except Exception:
            pass

    return {
        "last_updated": last_updated,
        "fighters_count": total_fighters,
        "events_count": total_events,
        "fights_count": total_fights,
        "sources": DATA_SOURCES,
    }
