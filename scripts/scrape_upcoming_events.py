"""Scrape scheduled (not yet fought) UFC events and their announced fight cards.

Reuses the same page-parsing logic as scrape_event_cards.py: an upcoming
event's fight rows never have a "win" flag, so parse_event_card() naturally
returns winner=None for every bout without any special-casing.

Small and cheap (usually under 10 events) — no resumability needed, just
re-run it to refresh; it always overwrites the full file.
"""

from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_event_cards import OUTPUT_FIELDS, parse_event_card
from scripts.scrape_fighter_career_stats import create_session, get_page

UPCOMING_URL = "http://ufcstats.com/statistics/events/upcoming?page=all"
OUTPUT_PATH = Path("data") / "raw" / "upcoming_events.csv"
REQUEST_DELAY_SECONDS = 0.6


def list_upcoming_events(soup: BeautifulSoup) -> list[tuple[str, str, str]]:
    events: list[tuple[str, str, str]] = []
    for row in soup.select("tr.b-statistics__table-row"):
        link = row.select_one("a.b-link_style_black")
        date_el = row.select_one(".b-statistics__date")
        if link is None or date_el is None:
            continue
        events.append((link.get_text(strip=True), date_el.get_text(strip=True), link["href"]))
    return events


def main() -> None:
    session = create_session()

    print(f"[info] Fetching {UPCOMING_URL} ...")
    listing_soup = get_page(session, UPCOMING_URL)
    events = list_upcoming_events(listing_soup)
    print(f"[info] {len(events)} upcoming events found.")

    all_fights: list[dict] = []
    for index, (event_name, event_date, event_url) in enumerate(events, start=1):
        try:
            soup = get_page(session, event_url)
            fights = parse_event_card(soup, event_name, event_date, event_url)
        except RuntimeError as exc:
            print(f"[error] Giving up on {event_url}: {exc}")
            fights = []

        all_fights.extend(fights)
        print(f"[progress] {index}/{len(events)}: {event_name} — {len(fights)} announced fights")
        time.sleep(REQUEST_DELAY_SECONDS)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(all_fights)

    print(f"[info] Saved {len(all_fights)} announced fights across {len(events)} upcoming events.")


if __name__ == "__main__":
    main()
