"""Read the UFC's official career "Record Book" into data/raw/stat_leaders.csv.

https://statleaders.ufc.com/en/career is one server-rendered page with the top fighters of all UFC history for 32
career stats (total fights, wins, finishes, striking, grappling, control time...), counting every fight since UFC 28.
robots.txt does not restrict it and one request is enough.

The CSV keeps what the page says: the stat, its qualifying note ("Minimum 5 UFC Fights"), the unit, and each leader's
rank (ties share a rank), name and value, plus the UFC athlete page. Headshots are not copied.

Usage (from the repo root):
    python -m scripts.scrape_stat_leaders
"""

from __future__ import annotations

import csv
import re
import sys
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.http_retry import get_with_retry
from src.ufc_predictor.config import RAW_DATA_DIR

URL = "https://statleaders.ufc.com/en/career"
OUTPUT_PATH = RAW_DATA_DIR / "stat_leaders.csv"
HEADERS = {"User-Agent": "ufcpredictor/1.0 (personal project; reads one public page)"}
FIELDS = ["category", "stat_key", "stat", "note", "unit", "rank", "fighter", "value", "ufc_url", "updated"]
CATEGORY_LABELS = {"Fights": "Fights", "Lutas": "Fights", "Time": "Time", "Tempo": "Time", "Striking": "Striking", "Grappling": "Grappling"}
MINIMUM_STATS = 30


def parse_updated(text: str) -> str:
    """"Last Update: 10/15/2026 07:45 GMT" -> "2026-10-15"."""
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if not match:
        return ""
    month, day, year = (int(part) for part in match.groups())
    return datetime(year, month, day).date().isoformat()


def parse(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    stamp = soup.find(id="results-nav--last-updated")
    updated = parse_updated(stamp.get_text(" ", strip=True)) if stamp else ""

    rows: list[dict] = []
    for group in soup.select("article.results-group"):
        classes = [name for name in group.get("class", []) if name.endswith("-group") and name != "results-group"]
        category = CATEGORY_LABELS.get(classes[0].removesuffix("-group") if classes else "", "")
        header = group.find("header")
        stat = header.find("h3").get_text(strip=True) if header and header.find("h3") else ""
        note_tag = header.find("p") if header else None
        note = note_tag.get_text(" ", strip=True).replace("\xa0", " ").strip() if note_tag else ""
        columns = [span.get_text(strip=True) for span in group.select(".results-table--th > span")]
        unit = columns[2] if len(columns) > 2 else ""
        stat_key = group.get("id", "").removesuffix("-group")
        for row in group.select(".results-table--tr:not(.results-table--th)"):
            cells = row.find_all("span", recursive=False)
            if len(cells) < 3:
                continue
            link = cells[1].find("a")
            rows.append(
                {
                    "category": category,
                    "stat_key": stat_key,
                    "stat": stat,
                    "note": note,
                    "unit": unit,
                    "rank": cells[0].get_text(strip=True),
                    "fighter": cells[1].get_text(strip=True),
                    "value": cells[2].get_text(strip=True),
                    "ufc_url": link.get("href", "").strip() if link else "",
                    "updated": updated,
                }
            )
    return rows


def main() -> None:
    response = get_with_retry(URL, headers=HEADERS, timeout=60)
    rows = parse(response.content.decode("utf-8", errors="replace"))
    stats = {row["stat_key"] for row in rows}
    if len(stats) < MINIMUM_STATS or any(not row["fighter"] or not row["value"] for row in rows):
        raise SystemExit(f"Parsed {len(stats)} stats; the page layout probably changed.")
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"[info] wrote {len(rows)} leaders for {len(stats)} stats to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
