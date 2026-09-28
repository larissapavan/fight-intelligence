from __future__ import annotations

from datetime import date

from backend.app.services.catalog_service import (
    HISTORICAL_PHOTOS_SOURCE_PATH,
    get_fighter_catalog,
    get_total_fights_tracked,
)
from backend.app.services.events_service import get_events
from src.ufc_predictor.config import RAW_DATA_DIR

DATA_SOURCES = ["ufcstats.com", "ufc.com"]

# Every raw dataset this app is built from — used only to find the most recent
# scrape/update timestamp, not to read their contents here.
TRACKED_SOURCE_FILES = [
    RAW_DATA_DIR / "fighters.csv",
    RAW_DATA_DIR / "fights.csv",
    RAW_DATA_DIR / "event_cards.csv",
    RAW_DATA_DIR / "fighter_career_stats.csv",
    RAW_DATA_DIR / "rankings.csv",
    RAW_DATA_DIR / "upcoming_events.csv",
    HISTORICAL_PHOTOS_SOURCE_PATH,
]


def get_data_info() -> dict:
    catalog = get_fighter_catalog()
    events = get_events()

    timestamps = [path.stat().st_mtime for path in TRACKED_SOURCE_FILES if path.exists()]
    last_updated = date.fromtimestamp(max(timestamps)).isoformat() if timestamps else None

    return {
        "last_updated": last_updated,
        "fighters_count": len(catalog),
        "events_count": len(events),
        "fights_count": get_total_fights_tracked(),
        "sources": DATA_SOURCES,
    }
