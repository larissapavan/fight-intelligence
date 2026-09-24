"""Scrape the official UFC divisional and pound-for-pound rankings.

ufc.com/rankings server-renders the "Media Panel" rankings (the traditional,
widely-cited UFC rankings) directly in the page HTML alongside an
experimental "Meta" ranking tab. We keep the first 13 groupings on the page,
which are the complete Media Panel set: Men's P4P, the 8 men's divisions,
Women's P4P, and the 3 standing women's divisions (UFC does not maintain a
women's featherweight ranking beyond the champion).

No auth, no bot-challenge, no pagination — one request gets everything.
Not resumable/incremental like the other scrapers because a full re-run
takes seconds, not hours; just re-run it whenever rankings need refreshing.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RANKINGS_URL = "https://www.ufc.com/rankings"
OUTPUT_PATH = Path("data") / "raw" / "rankings.csv"
TIMEOUT_SECONDS = 20

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

# Official Media Panel set: P4P groups first, then divisions.
GROUPS_EXPECTED = 13

DIVISION_LABELS = {
    "Peso-mosca": "Flyweight",
    "Peso-galo": "Bantamweight",
    "Peso-pena": "Featherweight",
    "Peso-leve": "Lightweight",
    "Peso Meio-Médio": "Welterweight",
    "Peso-médio": "Middleweight",
    "Peso meio-pesado": "Light Heavyweight",
    "Peso-pesado": "Heavyweight",
    "Peso-palha feminino": "Women's Strawweight",
    "Peso-mosca feminino": "Women's Flyweight",
    "Peso-galo feminino": "Women's Bantamweight",
    "Peso-pena feminino": "Women's Featherweight",
}

RANK_CHANGE_LABELS = {
    "Subiu": "up",
    "Desceu": "down",
    "Nova entrada": "new",
    "Sem mudança": None,
}

OUTPUT_FIELDS = ["category", "is_p4p", "rank", "fighter", "rank_change", "athlete_url"]


def fetch_rankings_html() -> str:
    response = requests.get(RANKINGS_URL, headers=HEADERS, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    response.encoding = "utf-8"
    return response.text


def classify_header(raw_header: str) -> tuple[str, bool] | None:
    header = raw_header.strip()
    if "Top Rank" in header:
        prefix = header.replace("Top Rank", "").strip()
        label = "Pound-for-Pound (Men's)" if prefix.lower().startswith("men") else "Pound-for-Pound (Women's)"
        return label, True

    label = DIVISION_LABELS.get(header)
    if label is None:
        return None
    return label, False


def parse_rank_change(cell_text: str) -> str | None:
    text = cell_text.strip()
    if not text:
        return None
    for prefix, label in RANK_CHANGE_LABELS.items():
        if text.startswith(prefix):
            return label
    return text or None


def parse_rankings(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    groups = soup.select(".view-grouping")[:GROUPS_EXPECTED]

    records: list[dict] = []
    for group in groups:
        header_el = group.select_one(".view-grouping-header")
        if header_el is None:
            continue
        classified = classify_header(header_el.get_text(strip=True))
        if classified is None:
            continue
        category, is_p4p = classified

        # P4P groups show the #1 P4P fighter as both a "champion" hero card
        # and row 1 of the table (there's no title at stake in P4P) — skip
        # the hero-card record there so the fighter isn't listed twice.
        champion_link = None if is_p4p else group.select_one(".rankings--athlete--champion h5 a")
        if champion_link is not None:
            records.append(
                {
                    "category": category,
                    "is_p4p": is_p4p,
                    "rank": 0,
                    "fighter": champion_link.get_text(strip=True),
                    "rank_change": None,
                    "athlete_url": champion_link.get("href"),
                }
            )

        for row in group.select("tbody tr"):
            cells = row.select("td")
            if len(cells) < 2:
                continue
            rank_text = cells[0].get_text(strip=True)
            if not rank_text.isdigit():
                continue
            fighter_link = cells[1].select_one("a")
            fighter_name = fighter_link.get_text(strip=True) if fighter_link else cells[1].get_text(strip=True)
            rank_change = parse_rank_change(cells[2].get_text(" ", strip=True)) if len(cells) > 2 else None

            records.append(
                {
                    "category": category,
                    "is_p4p": is_p4p,
                    "rank": int(rank_text),
                    "fighter": fighter_name,
                    "rank_change": rank_change,
                    "athlete_url": fighter_link.get("href") if fighter_link else None,
                }
            )

    return records


def save_rankings(records: list[dict]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(records)


def main() -> None:
    print("[info] Fetching https://www.ufc.com/rankings ...")
    html = fetch_rankings_html()
    records = parse_rankings(html)
    if not records:
        raise RuntimeError("Parsed zero ranking rows — page structure may have changed.")

    save_rankings(records)
    categories = sorted({record["category"] for record in records})
    print(f"[info] Saved {len(records)} ranking rows across {len(categories)} categories.")
    for category in categories:
        print(f"  - {category}")


if __name__ == "__main__":
    main()
