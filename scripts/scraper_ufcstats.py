from __future__ import annotations

import string
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup, Tag


BASE_URL = "http://ufcstats.com"
EVENTS_URL = "http://ufcstats.com/statistics/events/completed?page=all"
RAW_DATA_DIR = Path("data") / "raw"
REQUEST_DELAY_SECONDS = 0.75
TIMEOUT_SECONDS = 30
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}


def ensure_raw_directory() -> None:
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    return session


def request_with_retry(session: requests.Session, url: str) -> requests.Response:
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, timeout=TIMEOUT_SECONDS)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            print(f"[warn] Request failed ({attempt}/{MAX_RETRIES}) for {url}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY_SECONDS * attempt)

    raise RuntimeError(f"Failed to fetch {url}") from last_error


def get_soup(session: requests.Session, url: str) -> BeautifulSoup:
    response = request_with_retry(session, url)
    return BeautifulSoup(response.text, "html.parser")


def clean_text(node: Tag | None) -> str | None:
    if node is None:
        return None
    return " ".join(node.get_text(" ", strip=True).split())


def scrape_events(session: requests.Session) -> pd.DataFrame:
    print("[info] Scraping completed events...")
    soup = get_soup(session, EVENTS_URL)
    rows = soup.select("tr.b-statistics__table-row")
    events: list[dict[str, str | None]] = []

    for row in rows:
        link = row.select_one("a.b-link_style_black")
        date = row.select_one(".b-statistics__date")

        if link is None:
            continue

        events.append(
            {
                "event_name": clean_text(link),
                "event_date": clean_text(date),
                "event_url": link.get("href"),
            }
        )

    events_df = pd.DataFrame(events).drop_duplicates(subset=["event_url"]).reset_index(drop=True)
    events_df.to_csv(RAW_DATA_DIR / "events.csv", index=False, encoding="utf-8-sig")
    print(f"[info] Saved {len(events_df)} events to data/raw/events.csv")
    return events_df


def scrape_event_fights(session: requests.Session, event_row: pd.Series) -> list[dict[str, str | None]]:
    event_name = event_row.get("event_name", "Unknown event")
    event_url = event_row.get("event_url")

    if not isinstance(event_url, str) or not event_url:
        return []

    soup = get_soup(session, event_url)
    rows = soup.select("tr.b-fight-details__table-row")
    fights: list[dict[str, str | None]] = []

    for row in rows:
        fight_url = row.get("data-link")
        columns = [clean_text(td) for td in row.select("td")]
        fighter_links = row.select("a.b-link_style_black")
        fighter_names = [clean_text(link) for link in fighter_links[:2]]

        if not fight_url or len(columns) < 10:
            continue

        fights.append(
            {
                "event_name": event_name,
                "event_date": event_row.get("event_date"),
                "fight_url": fight_url,
                "winner": columns[0] if len(columns) > 0 else None,
                "fighter_1": fighter_names[0] if len(fighter_names) > 0 else None,
                "fighter_2": fighter_names[1] if len(fighter_names) > 1 else None,
                "weight_class": columns[6] if len(columns) > 6 else None,
                "method": columns[7] if len(columns) > 7 else None,
                "round": columns[8] if len(columns) > 8 else None,
                "time": columns[9] if len(columns) > 9 else None,
            }
        )

    return fights


def scrape_fights(session: requests.Session, events_df: pd.DataFrame) -> pd.DataFrame:
    print("[info] Scraping fights for each completed event...")
    all_fights: list[dict[str, str | None]] = []

    for index, event_row in events_df.iterrows():
        event_name = event_row.get("event_name", "Unknown event")
        print(f"[info] Event {index + 1}/{len(events_df)}: {event_name}")
        try:
            all_fights.extend(scrape_event_fights(session, event_row))
        except Exception as exc:  # pragma: no cover
            print(f"[warn] Failed to scrape fights for {event_name}: {exc}")

        time.sleep(REQUEST_DELAY_SECONDS)

    fights_df = pd.DataFrame(all_fights).drop_duplicates(subset=["fight_url"]).reset_index(drop=True)
    fights_df.to_csv(RAW_DATA_DIR / "fights.csv", index=False, encoding="utf-8-sig")
    print(f"[info] Saved {len(fights_df)} fights to data/raw/fights.csv")
    return fights_df


def scrape_fighters(session: requests.Session) -> pd.DataFrame:
    print("[info] Scraping fighters catalog...")
    fighters: list[dict[str, str | None]] = []

    for letter in string.ascii_lowercase:
        url = f"{BASE_URL}/statistics/fighters?char={letter}&page=all"
        print(f"[info] Fighter page: {letter}")

        try:
            soup = get_soup(session, url)
        except Exception as exc:  # pragma: no cover
            print(f"[warn] Failed to scrape fighters for '{letter}': {exc}")
            time.sleep(REQUEST_DELAY_SECONDS)
            continue

        rows = soup.select("tr.b-statistics__table-row")

        for row in rows:
            columns = [clean_text(td) for td in row.select("td")]
            link = row.select_one("a.b-link_style_black")

            if len(columns) < 11:
                continue

            fighters.append(
                {
                    "first_name": columns[0],
                    "last_name": columns[1],
                    "nickname": columns[2],
                    "height": columns[3],
                    "weight": columns[4],
                    "reach": columns[5],
                    "stance": columns[6],
                    "wins": columns[7],
                    "losses": columns[8],
                    "draws": columns[9],
                    "belt": columns[10],
                    "fighter_url": link.get("href") if link else None,
                }
            )

        time.sleep(REQUEST_DELAY_SECONDS)

    fighters_df = pd.DataFrame(fighters).drop_duplicates(subset=["fighter_url"]).reset_index(drop=True)
    fighters_df.to_csv(RAW_DATA_DIR / "fighters.csv", index=False, encoding="utf-8-sig")
    print(f"[info] Saved {len(fighters_df)} fighters to data/raw/fighters.csv")
    return fighters_df


def main() -> None:
    ensure_raw_directory()
    session = create_session()

    try:
        events_df = scrape_events(session)
        scrape_fights(session, events_df)
        scrape_fighters(session)
    finally:
        session.close()

    print("[info] Scraping completed successfully.")
    print("[info] Generated files:")
    print(" - data/raw/events.csv")
    print(" - data/raw/fights.csv")
    print(" - data/raw/fighters.csv")


if __name__ == "__main__":
    main()
