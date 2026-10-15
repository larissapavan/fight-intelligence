"""Read the UFC roster from roster.watch into data/raw/roster_watch.csv.

Two static pages, one request each:
- https://www.roster.watch/              the active roster ("UFC Fighters & Active Roster 2026")
- https://www.roster.watch/former.html   fighters who left the UFC (retired, released or moved on)

Every row carries its data in `data-*` attributes: nationalities (every flag the site lists, the first one being
the country the fighter represents), date of birth, weight classes, debut, last and next fight, bouts, record and
the origin and honor badges: Dana White's Contender Series, The Ultimate Fighter, Road to UFC, Strikeforce, WEC,
Pride, BMF champion, Hall of Fame and GOAT.

Each row is linked to our fighter_url. roster.watch spells some names differently (Cris Cyborg / Cristiane Justino),
so rows whose name does not match are linked by date of birth plus last fight date, and left unlinked when that is
not conclusive.

Usage (from the repo root):
    python -m scripts.scrape_roster_watch
"""

from __future__ import annotations

import csv
import difflib
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ufc_predictor.config import RAW_DATA_DIR
from src.ufc_predictor.countries import country_code

PAGES = {"active": "https://www.roster.watch/", "former": "https://www.roster.watch/former.html"}
OUTPUT_PATH = RAW_DATA_DIR / "roster_watch.csv"
FIGHTERS_PATH = RAW_DATA_DIR / "fighters.csv"
CAREER_STATS_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"
EVENT_CARDS_PATH = RAW_DATA_DIR / "event_cards.csv"
HEADERS = {"User-Agent": "ufcpredictor/1.0 (personal project; reads two public pages)"}
FIELDS = [
    "name", "profile", "status", "gender", "dob", "debut", "last_fight", "next_fight", "bouts", "wins", "losses",
    "weight_classes", "countries", "country_codes", "badges", "fighter_url", "link",
]
# data-* attribute on the row -> badge key
BADGE_ATTRIBUTES = {
    "data-bmf": "bmf",
    "data-hof": "hof",
    "data-dwcs": "dwcs",
    "data-tuf": "tuf",
    "data-r2ufc": "r2u",
    "data-sf": "sf",
    "data-wec": "wec",
    "data-pride": "pride",
}
BADGE_ORDER = ["goat", "bmf", "hof", "dwcs", "tuf", "r2u", "sf", "wec", "pride"]


def parse(html: str, status: str) -> list[dict]:
    rows = []
    for tr in BeautifulSoup(html, "html.parser").find_all("tr"):
        if not tr.get("data-fighter"):
            continue
        link = tr.find("a")
        try:
            weight_classes = ", ".join(json.loads(tr.get("data-weightclass") or "[]"))
        except ValueError:
            weight_classes = ""
        countries = [div.get("title", "").strip() for div in tr.select("td.td-country div.emoji") if div.get("title")]
        codes = [country_code(name) or "" for name in countries]
        badges = {badge for attribute, badge in BADGE_ATTRIBUTES.items() if tr.get(attribute) == "true"}
        if tr.find(attrs={"title": "Greatest of all Time"}):
            badges.add("goat")
        rows.append(
            {
                "name": tr["data-fighter"].strip(),
                "profile": f"https://www.roster.watch{link['href']}" if link and link.get("href") else "",
                "status": status,
                "gender": tr.get("data-gender", ""),
                "dob": tr.get("data-dob", ""),
                "debut": tr.get("data-debut", ""),
                "last_fight": tr.get("data-prev", ""),
                "next_fight": tr.get("data-next", ""),
                "bouts": tr.get("data-bouts", ""),
                "wins": tr.get("data-wins", ""),
                "losses": tr.get("data-losses", ""),
                "weight_classes": weight_classes,
                "countries": "|".join(countries),
                "country_codes": "|".join(codes),
                "badges": "|".join(badge for badge in BADGE_ORDER if badge in badges),
            }
        )
    return rows


def name_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def _iso(value: str) -> str:
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def load_catalog() -> list[dict]:
    """Fighters (name, fighter_url, dob) and their last fight date, as it appears in event_cards.csv."""
    with CAREER_STATS_PATH.open(encoding="utf-8", newline="") as handle:
        dob_by_url = {row["fighter_url"]: _iso(row.get("dob", "")) for row in csv.DictReader(handle)}
    with FIGHTERS_PATH.open(encoding="utf-8", newline="") as handle:
        fighters = [
            {
                "name": f"{row['first_name']} {row['last_name']}".strip(),
                "fighter_url": row["fighter_url"],
                "dob": dob_by_url.get(row["fighter_url"], ""),
            }
            for row in csv.DictReader(handle)
        ]
    last_fight: dict[str, str] = {}
    with EVENT_CARDS_PATH.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            day = _iso(row.get("event_date", ""))
            for column in ("fighter_1", "fighter_2"):
                key = name_key(row.get(column, "") or "")
                if key and day and day > last_fight.get(key, ""):
                    last_fight[key] = day
    for fighter in fighters:
        fighter["key"] = name_key(fighter["name"])
        fighter["last_fight"] = last_fight.get(fighter["key"], "")
    return fighters


def link_rows(rows: list[dict], fighters: list[dict]) -> None:
    """Fill fighter_url and link ("name", "dob+last fight", ...) for every row we can identify safely."""
    by_key: dict[str, list[dict]] = {}
    for fighter in fighters:
        by_key.setdefault(fighter["key"], []).append(fighter)
    taken: set[str] = set()

    def claim(row: dict, fighter: dict, how: str) -> None:
        row["fighter_url"], row["link"] = fighter["fighter_url"], how
        taken.add(fighter["fighter_url"])

    for row in rows:
        row["fighter_url"], row["link"] = "", ""
        candidates = by_key.get(name_key(row["name"]), [])
        # Same name: a homonym is ruled out when the birth dates agree, one side has none, or the last fight date
        # matches (the two sites disagree on a few birth dates, e.g. Forrest Griffin).
        agreeing = [
            c
            for c in candidates
            if c["fighter_url"] not in taken
            and (
                not c["dob"]
                or not row["dob"]
                or c["dob"] == row["dob"]
                or (row["last_fight"] and c["last_fight"] == row["last_fight"])
            )
        ]
        if len(agreeing) > 1:  # homonyms (two "Jean Silva"): keep the one the dates actually confirm
            agreeing = [
                c
                for c in agreeing
                if (row["dob"] and c["dob"] == row["dob"]) or (row["last_fight"] and c["last_fight"] == row["last_fight"])
            ]
        if len(agreeing) > 1 and row["dob"]:  # still tied: the birth date that is clearly closest (sites are days apart)
            gaps = sorted((abs((_date(c["dob"]) - _date(row["dob"])).days), c) for c in agreeing if c["dob"])
            if gaps and gaps[0][0] <= 45 and (len(gaps) == 1 or gaps[1][0] > 365):
                agreeing = [gaps[0][1]]
        if len(agreeing) == 1:
            claim(row, agreeing[0], "name")
    for row in rows:
        if row["fighter_url"]:
            continue
        # A very similar name and the same last fight, whatever the birth date says.
        close = [
            f
            for f in fighters
            if f["fighter_url"] not in taken
            and row["last_fight"]
            and f["last_fight"] == row["last_fight"]
            and difflib.SequenceMatcher(None, name_key(row["name"]), f["key"]).ratio() >= 0.8
        ]
        if len(close) == 1:
            claim(row, close[0], "last fight+name")
    for row in rows:
        if row["fighter_url"] or not row["dob"]:
            continue
        same_dob = [f for f in fighters if f["dob"] == row["dob"] and f["fighter_url"] not in taken]
        by_last = [f for f in same_dob if row["last_fight"] and f["last_fight"] == row["last_fight"]]
        if len(by_last) == 1:
            claim(row, by_last[0], "dob+last fight")
            continue
        similar = [f for f in same_dob if difflib.SequenceMatcher(None, name_key(row["name"]), f["key"]).ratio() >= 0.72]
        if len(similar) == 1:
            claim(row, similar[0], "dob+name")


def fetch_rows() -> list[dict]:
    rows: list[dict] = []
    for status, url in PAGES.items():
        response = requests.get(url, headers=HEADERS, timeout=60)
        response.raise_for_status()
        page_rows = parse(response.content.decode("utf-8", errors="replace"), status)
        minimum = 400 if status == "active" else 1000
        if len(page_rows) < minimum:
            raise SystemExit(f"Only {len(page_rows)} {status} rows parsed from {url}; the page layout probably changed.")
        rows.extend(page_rows)
    # A fighter can be on both pages (came back to the UFC): the active row wins. Pages also repeat a few names.
    unique: dict[tuple, dict] = {}
    for row in sorted(rows, key=lambda r: r["status"] != "active"):
        unique.setdefault((row["name"], row["dob"], row["debut"]), row)
    return list(unique.values())


def main() -> None:
    rows = fetch_rows()
    link_rows(rows, load_catalog())
    # One row per fighter_url: if both pages matched the same fighter, keep the active one.
    seen: set[str] = set()
    for row in sorted(rows, key=lambda r: r["status"] != "active"):
        if row["fighter_url"] and row["fighter_url"] in seen:
            row["fighter_url"], row["link"] = "", ""
        elif row["fighter_url"]:
            seen.add(row["fighter_url"])
    linked = sum(1 for row in rows if row["fighter_url"])
    unknown = sorted({name for row in rows for name, code in zip(row["countries"].split("|"), row["country_codes"].split("|")) if name and not code})
    print(f"[info] {len(rows)} fighters ({sum(r['status'] == 'active' for r in rows)} active), {linked} linked to ours")
    if unknown:
        print(f"[warn] countries without a flag code: {unknown}")
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\r\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"[info] wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
