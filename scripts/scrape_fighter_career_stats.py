"""Scrape per-fighter career stats (DOB, striking/takedown accuracy) from ufcstats.com.

ufcstats.com fronts every page with a JavaScript proof-of-work challenge. This
script solves that challenge once per session (the resulting cookie is reused
for all subsequent requests) and then visits each fighter's detail page to
pull the career stats that are missing from data/raw/fighters.csv: DOB,
striking accuracy, takedown accuracy, and a few related fields.

Resumable: progress is appended to OUTPUT_PATH after every fighter, and a
re-run skips fighter_urls that are already present in that file.
"""

from __future__ import annotations

import csv
import hashlib
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup

RAW_DATA_DIR = Path("data") / "raw"
FIGHTERS_SOURCE_PATH = RAW_DATA_DIR / "fighters.csv"
FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "fights.csv"
OUTPUT_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"

REQUEST_DELAY_SECONDS = 0.6
TIMEOUT_SECONDS = 20
MAX_RETRIES = 3
PROGRESS_EVERY = 50

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

OUTPUT_FIELDS = [
    "fighter_url",
    "dob",
    "sig_str_acc",
    "takedown_acc",
    "slpm",
    "sapm",
    "str_def",
    "td_avg",
    "td_def",
    "sub_avg",
    "wins",
    "losses",
    "draws",
]

RECORD_PATTERN = re.compile(r"Record:\s*(\d+)-(\d+)-(\d+)")

FIELD_LABELS = {
    "DOB": "dob",
    "Str. Acc.": "sig_str_acc",
    "TD Acc.": "takedown_acc",
    "SLpM": "slpm",
    "SApM": "sapm",
    "Str. Def": "str_def",
    "TD Avg.": "td_avg",
    "TD Def.": "td_def",
    "Sub. Avg.": "sub_avg",
}


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    return session


def is_challenge_page(html: str) -> bool:
    return "Checking your browser" in html


def solve_pow_challenge(session: requests.Session, response: requests.Response) -> bool:
    """Solve ufcstats.com's SHA-256 proof-of-work bot challenge.

    The page embeds a nonce and a required number of leading zero hex chars.
    We brute force a counter n such that sha256(f"{nonce}:{n}") matches, then
    POST it to /__c, which sets a cookie that clears the challenge for the
    rest of the session.
    """

    html = response.text
    nonce_match = re.search(r'var nonce="([0-9a-f]+)"', html)
    target_match = re.search(r"target=new Array\((\d+)\+1\)", html)
    if not nonce_match or not target_match:
        return False

    nonce = nonce_match.group(1)
    difficulty = int(target_match.group(1))
    target_prefix = "0" * difficulty

    counter = 0
    while not hashlib.sha256(f"{nonce}:{counter}".encode()).hexdigest().startswith(target_prefix):
        counter += 1

    challenge_url = urljoin(response.url, "/__c")
    ack = session.post(challenge_url, data={"nonce": nonce, "n": counter}, timeout=TIMEOUT_SECONDS)
    return ack.status_code < 400


def get_page(session: requests.Session, url: str) -> BeautifulSoup:
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, timeout=TIMEOUT_SECONDS)
            response.raise_for_status()
            if is_challenge_page(response.text):
                if not solve_pow_challenge(session, response):
                    raise RuntimeError("Could not parse proof-of-work challenge")
                response = session.get(url, timeout=TIMEOUT_SECONDS)
                response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except (requests.RequestException, RuntimeError) as exc:
            last_error = exc
            print(f"[warn] Request failed ({attempt}/{MAX_RETRIES}) for {url}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY_SECONDS * attempt * 2)

    raise RuntimeError(f"Failed to fetch {url}") from last_error


def parse_career_stats(soup: BeautifulSoup, fighter_url: str) -> dict:
    record: dict = {field: None for field in OUTPUT_FIELDS}
    record["fighter_url"] = fighter_url

    for item in soup.select(".b-list__box-list-item"):
        text = " ".join(item.get_text(" ", strip=True).split())
        for label, field in FIELD_LABELS.items():
            prefix = f"{label}:"
            if text.startswith(prefix):
                value = text[len(prefix):].strip()
                record[field] = value or None
                break

    title_block = soup.select_one(".b-content__title-record")
    if title_block:
        match = RECORD_PATTERN.search(title_block.get_text(" ", strip=True))
        if match:
            record["wins"], record["losses"], record["draws"] = match.groups()

    return record


def load_fighter_urls() -> list[str]:
    """Fighter URLs ordered with the most recently active fighters first.

    Popular/active fighters are the ones people actually search for in the
    app, so they should get real career stats before the long tail of
    inactive roster entries.
    """

    if not FIGHTERS_SOURCE_PATH.exists():
        raise FileNotFoundError(f"Missing {FIGHTERS_SOURCE_PATH}")

    fighters_df = pd.read_csv(FIGHTERS_SOURCE_PATH)
    fighters_df["full_name"] = (
        fighters_df["first_name"].fillna("").astype(str).str.strip()
        + " "
        + fighters_df["last_name"].fillna("").astype(str).str.strip()
    ).str.strip()

    recency = _load_last_fight_date_by_name()
    fighters_df["last_fight_date"] = fighters_df["full_name"].map(recency)
    fighters_df = fighters_df.sort_values(
        "last_fight_date", ascending=False, na_position="last"
    )

    return fighters_df["fighter_url"].dropna().astype(str).unique().tolist()


def _load_last_fight_date_by_name() -> dict:
    if not FIGHTS_SOURCE_PATH.exists():
        return {}

    fights_df = pd.read_csv(FIGHTS_SOURCE_PATH, usecols=["event_date", "fighter_1", "fighter_2"])
    fights_df["event_date"] = pd.to_datetime(fights_df["event_date"], errors="coerce")

    first_view = fights_df[["event_date", "fighter_1"]].rename(columns={"fighter_1": "name"})
    second_view = fights_df[["event_date", "fighter_2"]].rename(columns={"fighter_2": "name"})
    history = pd.concat([first_view, second_view], ignore_index=True).dropna(subset=["name", "event_date"])

    latest = history.groupby("name")["event_date"].max()
    return latest.to_dict()


def load_scraped_urls() -> set[str]:
    if not OUTPUT_PATH.exists():
        return set()
    existing = pd.read_csv(OUTPUT_PATH)
    return set(existing["fighter_url"].dropna().astype(str))


def append_record(record: dict, write_header: bool) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow(record)


def main() -> None:
    all_urls = load_fighter_urls()
    already_scraped = load_scraped_urls()
    pending_urls = [url for url in all_urls if url not in already_scraped]

    print(f"[info] {len(all_urls)} fighters total, {len(already_scraped)} already scraped, {len(pending_urls)} pending.")
    if not pending_urls:
        print("[info] Nothing to do.")
        return

    session = create_session()
    write_header = not OUTPUT_PATH.exists()
    scraped_now = 0

    for index, fighter_url in enumerate(pending_urls, start=1):
        try:
            soup = get_page(session, fighter_url)
            record = parse_career_stats(soup, fighter_url)
        except RuntimeError as exc:
            print(f"[error] Giving up on {fighter_url}: {exc}")
            record = {field: None for field in OUTPUT_FIELDS}
            record["fighter_url"] = fighter_url

        append_record(record, write_header)
        write_header = False
        scraped_now += 1

        if index % PROGRESS_EVERY == 0 or index == len(pending_urls):
            print(f"[progress] {index}/{len(pending_urls)} pending fighters scraped this run "
                  f"({len(already_scraped) + scraped_now}/{len(all_urls)} total).")

        time.sleep(REQUEST_DELAY_SECONDS)

    print("[info] Done.")


if __name__ == "__main__":
    main()
