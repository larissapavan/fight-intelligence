"""Write the site's RSS feed (frontend/public/feed.xml): the model's picks for each announced card, and how it did on each finished one.

    python -m scripts.build_feed

It reads only data/raw/prediction_log.csv, so it needs neither the model nor the network. The daily update runs it
after the picks are logged and settled, which is when something in the feed can change. A feed reader (or any RSS-to-email
service) turns it into the alert "a new card is out" or "this card is settled" without the site needing accounts or a mailer.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.track_record_service import load_log

SITE = "https://fight-intelligence.vercel.app"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "frontend" / "public" / "feed.xml"
ITEM_LIMIT = 20
ATOM = "http://www.w3.org/2005/Atom"


def _when(day: str | None) -> datetime:
    parsed = pd.to_datetime(day, errors="coerce")
    return datetime(2000, 1, 1, tzinfo=timezone.utc) if pd.isna(parsed) else parsed.to_pydatetime().replace(tzinfo=timezone.utc)


def _percent(value) -> str:
    return f"{float(value):.0%}"


def items_from_log(log: pd.DataFrame) -> list[dict]:
    """One item per event: picks while any fight is still to come, a results summary once all are settled."""
    items = []
    for (event, event_date), fights in log.groupby(["event_name", "event_date"], sort=False):
        settled = fights["resolved_at"] != ""
        if not settled.all():
            lines = [
                f"{row.fighter_1} vs. {row.fighter_2}: the model picks {row.predicted_winner} ({_percent(row.confidence)})"
                for row in fights.itertuples()
            ]
            items.append({
                "title": f"Picks for {event} ({event_date})",
                "link": f"{SITE}/events",
                "guid": f"{SITE}/feed/picks/{event_date}/{event}",
                "date": _when(fights["logged_at"].max()),
                "lines": lines,
            })
            continue
        counted = fights[fights["correct"].isin(["True", "False"])]
        right = int((counted["correct"] == "True").sum())
        misses = counted[counted["correct"] == "False"].sort_values("confidence", ascending=False)
        lines = [f"The model got {right} of {len(counted)} right."]
        if not misses.empty:
            worst = misses.iloc[0]
            lines.append(f"Biggest miss: {worst['predicted_winner']} at {_percent(worst['confidence'])}, but {worst['winner']} won.")
        items.append({
            "title": f"Results: {event} ({event_date})",
            "link": f"{SITE}/track-record",
            "guid": f"{SITE}/feed/results/{event_date}/{event}",
            "date": _when(fights["resolved_at"].max()),
            "lines": lines,
        })
    return sorted(items, key=lambda item: item["date"], reverse=True)[:ITEM_LIMIT]


def build_feed(log: pd.DataFrame, now: datetime | None = None) -> bytes:
    items = items_from_log(log) if not log.empty else []
    ET.register_namespace("atom", ATOM)
    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "Fight Intelligence: picks and results"
    ET.SubElement(channel, "link").text = SITE
    ET.SubElement(channel, "description").text = (
        "The model's pick for every announced UFC fight, saved before the card, and how it did once the results were in. "
        "For fun and learning, not betting advice."
    )
    ET.SubElement(channel, "language").text = "en"
    ET.SubElement(channel, f"{{{ATOM}}}link", href=f"{SITE}/feed.xml", rel="self", type="application/rss+xml")
    ET.SubElement(channel, "lastBuildDate").text = format_datetime(items[0]["date"] if items else (now or datetime(2000, 1, 1, tzinfo=timezone.utc)))
    for item in items:
        node = ET.SubElement(channel, "item")
        ET.SubElement(node, "title").text = item["title"]
        ET.SubElement(node, "link").text = item["link"]
        ET.SubElement(node, "guid", isPermaLink="false").text = item["guid"]
        ET.SubElement(node, "pubDate").text = format_datetime(item["date"])
        ET.SubElement(node, "description").text = "\n".join(item["lines"])
    ET.indent(rss)
    return ET.tostring(rss, encoding="utf-8", xml_declaration=True)


def main(argv: list[str] | None = None) -> int:
    feed = build_feed(load_log())
    OUTPUT_PATH.write_bytes(feed)
    print(f"[info] wrote {OUTPUT_PATH.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
