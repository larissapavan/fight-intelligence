"""Collect the country each fighter represents and where they come from, into data/raw/fighter_origins.csv.

Two public sources:
- ESPN athlete profile (JSON): citizenship, i.e. the country the fighter represents in the UFC (Tsarukyan was
  born in Georgia but fights for Armenia; Topuria was born in Germany but fights for Georgia).
  Covers every fighter we can match to an ESPN athlete id.
- ufc.com athlete page: "hometown" (city and country, shown as the place they come from). ufc.com keeps pages for
  former fighters too, so every fighter is tried once; a fighter whose page was already read is not asked again. The
  page is served in Portuguese, so the country at the end of the hometown is translated to English
  (src/ufc_predictor/countries.py).

The flag is the country the fighter represents (ESPN citizenship); the hometown country is only a fallback.

The script is resumable: fighters already in the CSV are skipped unless --refresh is given.

Usage (from the repo root):
    python -m scripts.scrape_fighter_origins
    python -m scripts.scrape_fighter_origins --limit 50
    python -m scripts.scrape_fighter_origins --skip-ufc          # ESPN only
    python -m scripts.scrape_fighter_origins --refresh
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.download_fighter_photos import espn_athletes, slugify
from scripts.scrape_espn import ATHLETE_URL, Catalog, EspnClient, load_csv, name_key
from src.ufc_predictor.config import RAW_DATA_DIR
from src.ufc_predictor.countries import country_code, translate_hometown

OUTPUT_PATH = RAW_DATA_DIR / "fighter_origins.csv"
FIGHTERS_PATH = RAW_DATA_DIR / "fighters.csv"
CAREER_STATS_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"
FIELDS = ["name", "fighter_url", "hometown", "country", "country_code", "citizenship", "source", "checked"]
UFC_ATHLETE_URL = "https://www.ufc.com/athlete/{slug}"
UFC_HEADERS = {"User-Agent": "ufcpredictor/1.0 (personal project; reads public athlete pages)", "Accept-Language": "en-US,en;q=0.9"}
UFC_DELAY_SECONDS = 1.2
HOMETOWN_LABELS = {"Cidade natal", "Hometown"}


def load_rows() -> dict[str, dict]:
    if not OUTPUT_PATH.exists():
        return {}
    with OUTPUT_PATH.open(encoding="utf-8", newline="") as handle:
        return {row["fighter_url"] or row["name"]: row for row in csv.DictReader(handle)}


def save_rows(rows: dict[str, dict]) -> None:
    ordered = sorted(rows.values(), key=lambda row: row["name"].lower())
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\r\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(ordered)


def decode_page(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1")


def parse_ufc_page(html: str, name: str) -> dict | None:
    """hometown from an ufc.com athlete page, or None when the page is for someone else."""
    soup = BeautifulSoup(html, "html.parser")
    heading = soup.find("h1")
    if heading is None or name_key(heading.get_text(" ", strip=True)) != name_key(name):
        return None
    bio: dict[str, str] = {}
    for label in soup.select(".c-bio__label"):
        value = label.find_next_sibling()
        if value is not None:
            bio[label.get_text(strip=True)] = value.get_text(" ", strip=True)
    hometown = next((bio[key] for key in HOMETOWN_LABELS if bio.get(key)), "")
    return {"hometown": hometown}


def espn_profile(payload: dict) -> dict:
    return {"citizenship": (payload.get("citizenship") or "").strip()}


def merge(name: str, fighter_url: str, espn: dict, ufc: dict | None) -> dict:
    hometown, hometown_code = translate_hometown(ufc["hometown"]) if ufc else (None, None)
    citizenship = espn.get("citizenship", "")
    citizenship_code = country_code(citizenship)
    # The flag is the country the fighter represents. The hometown country only fills in when ESPN has no citizenship.
    if citizenship_code:
        code, country = citizenship_code, citizenship
    elif hometown_code and hometown:
        code, country = hometown_code, hometown.split(",")[-1].strip()
    else:
        code, country = "", citizenship
    sources = [source for source, present in (("ESPN", bool(espn)), ("ufc.com", bool(ufc))) if present]
    return {
        "name": name,
        "fighter_url": fighter_url,
        "hometown": hometown or "",
        "country": country,
        "country_code": code,
        "citizenship": citizenship,
        "source": " + ".join(sources),
        "checked": date.today().isoformat(),
    }


def active_names() -> set[str]:
    from backend.app.services.catalog_service import list_fighters

    return {name_key(fighter["name"]) for fighter in list_fighters() if fighter.get("is_active")}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--limit", type=int, help="max fighters to process in this run")
    parser.add_argument("--refresh", action="store_true", help="re-fetch fighters already in the CSV")
    parser.add_argument("--skip-ufc", action="store_true", help="ESPN only (no ufc.com pages)")
    args = parser.parse_args(argv)

    fighters = load_csv(FIGHTERS_PATH)[1]
    career = load_csv(CAREER_STATS_PATH)[1] if CAREER_STATS_PATH.exists() else []
    catalog = Catalog(fighters, career)
    client = EspnClient()

    print("[info] Reading ESPN athlete ids from the UFC history ...")
    id_by_row: dict[int, list[str]] = {}
    for athlete in espn_athletes(client).values():
        row, status = catalog.find(athlete)
        if row is not None and status in {"exact", "fuzzy"}:
            id_by_row.setdefault(id(row), []).append(athlete.espn_id)

    active = set() if args.skip_ufc else active_names()
    rows = load_rows()
    todo = []
    for row in catalog.rows:
        name = catalog.name_of(row)
        key = row.get("fighter_url") or name
        ids = id_by_row.get(id(row), [])
        existing = rows.get(key)
        ufc_read = existing is not None and "ufc.com" in existing.get("source", "")
        wants_ufc = not args.skip_ufc and (args.refresh or not ufc_read)
        if (len(ids) == 1 or wants_ufc) and (args.refresh or existing is None or wants_ufc):
            todo.append((name, row.get("fighter_url", ""), ids[0] if len(ids) == 1 else None, wants_ufc))
    todo.sort(key=lambda item: name_key(item[0]) not in active)  # active fighters first: they matter most on screen
    if args.limit:
        todo = todo[: args.limit]
    print(f"[info] {len(todo)} fighters to process ({sum(1 for item in todo if item[3])} active)")

    session = requests.Session()
    session.headers.update(UFC_HEADERS)
    done = with_ufc = errors = 0
    for index, (name, fighter_url, espn_id, wants_ufc) in enumerate(todo, 1):
        espn: dict = {}
        known = rows.get(fighter_url or name)
        if known and "ESPN" in known.get("source", "") and not args.refresh:
            espn = {"citizenship": known.get("citizenship", "")}  # already read: only ufc.com is missing
        elif espn_id:
            try:
                espn = espn_profile(client.get_json(ATHLETE_URL.format(athlete_id=espn_id)))
            except RuntimeError:
                errors += 1
            time.sleep(0.3)
        ufc = None
        if wants_ufc:
            try:
                response = session.get(UFC_ATHLETE_URL.format(slug=slugify(name)), timeout=30)
                if response.status_code in (200, 404):
                    # Remember that the page was tried, so a fighter without a hometown is not asked again.
                    ufc = (parse_ufc_page(decode_page(response.content), name) if response.status_code == 200 else None) or {
                        "hometown": ""
                    }
            except requests.RequestException:
                errors += 1
            time.sleep(UFC_DELAY_SECONDS)
        if ufc and ufc["hometown"]:
            with_ufc += 1
        if espn or ufc:
            rows[fighter_url or name] = merge(name, fighter_url, espn, ufc)
            done += 1
        if index % 50 == 0:
            save_rows(rows)
            print(f"  [{index}/{len(todo)}] saved={done} ufc.com={with_ufc} errors={errors}", flush=True)
    save_rows(rows)
    print(f"[info] fighter origins saved: {done} | with ufc.com hometown: {with_ufc} | errors: {errors}")


if __name__ == "__main__":
    main()
