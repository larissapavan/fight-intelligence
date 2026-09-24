"""Scrape full fight cards (with winner and venue) for every UFC event.

data/raw/fights.csv has no winner or venue — ufcstats.com's fight-listing
table never marked who won, and events.csv never captured the location. Both
are available on each event's own detail page in a single request: the venue
is in the page header, and every fight row lists the winner first (a green
"win" flag against the top-listed fighter) with the method split into a
short code (KO/TKO, U-DEC, SUB, ...) and a detail (Punches, Guillotine
Choke, ...).

Resumable like scrape_fighter_career_stats.py: progress is appended to
OUTPUT_PATH after every event, and a re-run skips event_urls already there.
"""

from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

import pandas as pd

if __package__ in (None, ""):
    # Allow `python scripts/scrape_event_cards.py` (direct execution) as well
    # as `python -m scripts.scrape_event_cards` by putting the repo root on
    # sys.path so the sibling-module import below resolves either way.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_fighter_career_stats import (
    HEADERS,  # noqa: F401  (re-exported for readers of this module)
    create_session,
    get_page,
)

RAW_DATA_DIR = Path("data") / "raw"
EVENTS_SOURCE_PATH = RAW_DATA_DIR / "events.csv"
OUTPUT_PATH = RAW_DATA_DIR / "event_cards.csv"

REQUEST_DELAY_SECONDS = 0.6
PROGRESS_EVERY = 25

OUTPUT_FIELDS = [
    "event_name",
    "event_date",
    "location",
    "event_url",
    "fight_url",
    "fighter_1",
    "fighter_2",
    "winner",
    "weight_class",
    "method",
    "method_detail",
    "round",
    "time",
]


def parse_event_card(soup, event_name: str, event_date: str, event_url: str) -> list[dict]:
    # Pull date and location straight from this event's own page rather than
    # trusting the event_date passed in from events.csv: a handful of rows
    # there have a corrupted event_date (a location string, not a date), and
    # the page's own date is in a consistent, authoritative format anyway.
    location = None
    for item in soup.select(".b-list__box-list-item"):
        text = " ".join(item.get_text(" ", strip=True).split())
        if text.startswith("Date:"):
            event_date = text[len("Date:"):].strip() or event_date
        elif text.startswith("Location:"):
            location = text[len("Location:"):].strip() or None

    fights: list[dict] = []
    for row in soup.select("tr.b-fight-details__table-row.js-fight-details-click"):
        cells = row.select("td")
        if len(cells) < 10:
            continue

        names = [p.get_text(" ", strip=True) for p in cells[1].select("p")]
        if len(names) < 2:
            continue
        fighter_1, fighter_2 = names[0], names[1]

        won_by_first = row.select_one(".b-flag_style_green") is not None
        winner = fighter_1 if won_by_first else None

        method_parts = [p.get_text(" ", strip=True) for p in cells[7].select("p")]
        method = method_parts[0] if method_parts else None
        method_detail = method_parts[1] if len(method_parts) > 1 and method_parts[1] else None

        weight_class = cells[6].get_text(" ", strip=True) or None
        round_text = cells[8].get_text(" ", strip=True)
        time_text = cells[9].get_text(" ", strip=True) or None
        fight_url = row.get("data-link")

        fights.append(
            {
                "event_name": event_name,
                "event_date": event_date,
                "location": location,
                "event_url": event_url,
                "fight_url": fight_url,
                "fighter_1": fighter_1,
                "fighter_2": fighter_2,
                "winner": winner,
                "weight_class": weight_class,
                "method": method,
                "method_detail": method_detail,
                "round": round_text or None,
                "time": time_text,
            }
        )

    return fights


def load_events() -> list[tuple[str, str, str]]:
    if not EVENTS_SOURCE_PATH.exists():
        raise FileNotFoundError(f"Missing {EVENTS_SOURCE_PATH}")
    df = pd.read_csv(EVENTS_SOURCE_PATH)
    df = df.sort_values("event_date", ascending=False, na_position="last")
    return list(df[["event_name", "event_date", "event_url"]].itertuples(index=False, name=None))


def load_scraped_event_urls() -> set[str]:
    if not OUTPUT_PATH.exists():
        return set()
    existing = pd.read_csv(OUTPUT_PATH)
    return set(existing["event_url"].dropna().astype(str))


def append_fights(fights: list[dict], write_header: bool) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerows(fights)


def main() -> None:
    all_events = load_events()
    already_scraped = load_scraped_event_urls()
    pending = [event for event in all_events if event[2] not in already_scraped]

    print(f"[info] {len(all_events)} events total, {len(already_scraped)} already scraped, {len(pending)} pending.")
    if not pending:
        print("[info] Nothing to do.")
        return

    session = create_session()
    write_header = not OUTPUT_PATH.exists()

    for index, (event_name, event_date, event_url) in enumerate(pending, start=1):
        try:
            soup = get_page(session, event_url)
            fights = parse_event_card(soup, event_name, event_date, event_url)
            if not fights:
                # Still record the event so a re-run doesn't retry it forever;
                # a card with zero parsed fights is usually a cancelled event.
                fights = [
                    {field: None for field in OUTPUT_FIELDS}
                    | {"event_name": event_name, "event_date": event_date, "event_url": event_url}
                ]
        except RuntimeError as exc:
            print(f"[error] Giving up on {event_url}: {exc}")
            fights = [
                {field: None for field in OUTPUT_FIELDS}
                | {"event_name": event_name, "event_date": event_date, "event_url": event_url}
            ]

        append_fights(fights, write_header)
        write_header = False

        if index % PROGRESS_EVERY == 0 or index == len(pending):
            print(f"[progress] {index}/{len(pending)} pending events scraped this run "
                  f"({len(already_scraped) + index}/{len(all_events)} total).")

        time.sleep(REQUEST_DELAY_SECONDS)

    print("[info] Done.")


if __name__ == "__main__":
    main()
