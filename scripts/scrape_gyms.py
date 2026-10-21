"""Scrape the MMA gyms and their fighters from FightHub (fighthub-app.com/br/gyms).

FightHub lists every gym ("academia") with the fighters whose last fight came out of it. Only the public pages its
robots.txt allows are read: the gym directory (paged) and one page per gym (paged again past 50 fighters). Requests are
spaced half a second apart with an identifiable User-Agent, like the PFL scraper (this one reuses its fetcher).

Output (data/raw/):
    gyms.csv          one row per gym: slug, name, url, fighters_count, checked
    gym_fighters.csv  one row per (gym, fighter): the fighter's name, nickname, division, flag and record as FightHub shows them

The site does not say which organization a fighter fights in, so matching them with the UFC and PFL fighters of this
project is done by name, in the API.

Later runs only re-read a gym page when its fighter count changed or the gym is new.

Usage (from the repo root):
    python -m scripts.scrape_gyms --dry-run
    python -m scripts.scrape_gyms
    python -m scripts.scrape_gyms --full --cache-dir .gyms-cache
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_espn import load_csv, save_csv
from scripts.scrape_pfl import Fetcher, clean, slug_of
from src.ufc_predictor.config import RAW_DATA_DIR

BASE_URL = "https://fighthub-app.com"
DIRECTORY_URL = f"{BASE_URL}/br/gyms/"
GYMS_PATH = RAW_DATA_DIR / "gyms.csv"
GYM_FIGHTERS_PATH = RAW_DATA_DIR / "gym_fighters.csv"

GYM_FIELDS = ["slug", "name", "url", "fighters_count", "checked"]
FIGHTER_FIELDS = ["gym_slug", "fighter", "fighter_slug", "nickname", "division", "country_code", "record"]

PAGE_SIZE = 50  # fighters per page on a gym page
MAX_PAGES = 40  # a stop for a directory that never ends

_REGIONAL_A = 0x1F1E6
_TAG_A = 0xE0061
_NATIONS = {"gbeng": "gb-eng", "gbsct": "gb-sct", "gbwls": "gb-wls", "gbnir": "gb-nir"}


def flag_code(text: str) -> str:
    """A flag emoji as the lowercase code the site's flags use: 🇧🇷 -> 'br', England's flag -> 'gb-eng'."""
    letters = [chr(ord("a") + ord(char) - _REGIONAL_A) for char in text if 0x1F1E6 <= ord(char) <= 0x1F1FF]
    if len(letters) >= 2:
        return "".join(letters[:2])
    tags = "".join(chr(ord("a") + ord(char) - _TAG_A) for char in text if 0xE0061 <= ord(char) <= 0xE007A)
    return _NATIONS.get(tags, "")


def parse_directory(html: str) -> list[dict]:
    """The gyms of one directory page: slug, name and how many fighters FightHub lists for it."""
    soup = BeautifulSoup(html, "html.parser")
    gyms = []
    for row in soup.select("a.fhx-row"):
        href = row.get("href", "")
        name = row.select_one(".fhx-row__name")
        count = row.select_one(".fhx-row__n")
        if not name or "/gyms/" not in href:
            continue
        number = re.sub(r"\D", "", count.get_text()) if count else ""
        gyms.append({"slug": slug_of(href), "name": clean(name.get_text()), "url": href.split("?")[0], "fighters_count": int(number or 0)})
    return gyms


def parse_gym_fighters(html: str, gym_slug: str) -> list[dict]:
    """The fighters on one gym page (a page holds up to 50)."""
    soup = BeautifulSoup(html, "html.parser")
    fighters = []
    for card in soup.select("a.fh-card"):
        href = card.get("href", "")
        name = card.select_one(".fh-card__name")
        if not name or "/fighters/" not in href:
            continue
        nickname = clean(card.select_one(".fh-card__nick").get_text()) if card.select_one(".fh-card__nick") else ""
        flag = card.select_one(".fh-card__flag")
        division = card.select_one(".fh-card__div")
        record = card.select_one(".fh-card__record")
        fighters.append(
            {
                "gym_slug": gym_slug,
                "fighter": clean(name.get_text()),
                "fighter_slug": slug_of(href),
                "nickname": nickname.strip("«» \xa0"),
                "division": clean(division.get_text()) if division else "",
                "country_code": flag_code(flag.get_text()) if flag else "",
                "record": clean(record.get_text()) if record else "",
            }
        )
    return fighters


def has_next_page(html: str, current: int) -> bool:
    return f"fh_page={current + 1}" in html


def fetch_directory(fetcher: Fetcher) -> list[dict]:
    gyms: dict[str, dict] = {}
    for page in range(1, MAX_PAGES + 1):
        html = fetcher.get(DIRECTORY_URL if page == 1 else f"{DIRECTORY_URL}?fh_page={page}")
        found = parse_directory(html)
        gyms.update({gym["slug"]: gym for gym in found})
        if not found or not has_next_page(html, page):
            break
    return list(gyms.values())


def fetch_gym_fighters(fetcher: Fetcher, gym: dict) -> list[dict]:
    fighters: dict[str, dict] = {}
    pages = max(1, -(-gym["fighters_count"] // PAGE_SIZE))
    for page in range(1, pages + 1):
        html = fetcher.get(gym["url"] if page == 1 else f"{gym['url']}?fh_page={page}")
        for fighter in parse_gym_fighters(html, gym["slug"]):
            fighters.setdefault(fighter["fighter_slug"], fighter)
    return list(fighters.values())


def gyms_problem(gyms: list[dict], previous: int = 0) -> str | None:
    """Why a scraped directory should not replace the stored one (None = it is fine)."""
    if not gyms:
        return "the directory returned no gyms"
    if previous and len(gyms) < previous * 0.8:
        return f"gyms dropped from {previous} to {len(gyms)}"
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="read and report, write nothing")
    parser.add_argument("--full", action="store_true", help="re-read every gym page")
    parser.add_argument("--delay", type=float, default=0.5)
    parser.add_argument("--cache-dir", type=Path, help="keep downloaded pages here so an interrupted run can resume")
    args = parser.parse_args(argv)

    fetcher = Fetcher(delay=args.delay, cache_dir=args.cache_dir)
    old_gyms = {row["slug"]: row for row in (load_csv(GYMS_PATH)[1] if GYMS_PATH.exists() else [])}
    old_fighters: dict[str, list[dict]] = {}
    for row in load_csv(GYM_FIGHTERS_PATH)[1] if GYM_FIGHTERS_PATH.exists() else []:
        old_fighters.setdefault(row["gym_slug"], []).append(row)

    gyms = fetch_directory(fetcher)
    problem = gyms_problem(gyms, previous=len(old_gyms))
    if problem:
        print(f"[error] {problem}; files left untouched")
        return 1
    print(f"[info] {len(gyms)} gyms in the directory")

    today = date.today().isoformat()
    rows: list[dict] = []
    fighter_rows: list[dict] = []
    failures: list[str] = []
    reread = 0
    for index, gym in enumerate(gyms, 1):
        before = old_gyms.get(gym["slug"])
        same = before is not None and int(before["fighters_count"]) == gym["fighters_count"] and gym["slug"] in old_fighters
        if same and not args.full:
            fighters, checked = old_fighters[gym["slug"]], before["checked"]
        else:
            try:
                fighters, checked = fetch_gym_fighters(fetcher, gym), today
                reread += 1
            except RuntimeError as error:
                failures.append(str(error))
                fighters, checked = old_fighters.get(gym["slug"], []), (before or {}).get("checked", "")
        rows.append({**gym, "checked": checked})
        fighter_rows.extend(fighters)
        if index % 100 == 0:
            print(f"[info] {index}/{len(gyms)} gyms")

    print(f"[info] {reread} gym pages read, {len(fighter_rows)} fighter rows, {len(failures)} failures")
    for failure in failures[:10]:
        print(f"[warn] {failure}")
    if args.dry_run:
        print("[dry-run] nothing written")
        return 0
    rows.sort(key=lambda row: (-row["fighters_count"], row["name"].lower()))
    save_csv(GYMS_PATH, GYM_FIELDS, rows)
    save_csv(GYM_FIGHTERS_PATH, FIGHTER_FIELDS, fighter_rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
