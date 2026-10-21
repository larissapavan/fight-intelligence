"""Collect the history of Bellator MMA (2009-2023) from ESPN's public JSON API and Wikipedia's list of champions.

Bellator was absorbed by the PFL after its last event in 2023, so this is a one-off archive, not a daily refresh.

- ESPN (site.api.espn.com / sports.core.api.espn.com, the same public API scripts/scrape_espn.py reads for the UFC):
  every event, its bouts, winners, finish round and time, the method (one call per bout) and each fighter's profile
  (height, reach, country, gym, record, photo). ESPN has no weight class per bout and no title flag.
- Wikipedia ("List of Bellator MMA champions", through its API): every title reign per division. It gives the champions
  Bellator ended with (the "rankings" page), flags the title bouts (a reign's first fight and its defenses, matched by date
  and the two names) and fills their weight class. Other bouts take the weight class both fighters' ESPN profiles agree on.

Output (data/raw/bellator/), the same three files every non-UFC organization has (see backend/app/services/org_service.py):
    fights.csv, fighters.csv, rankings.csv

The first run makes roughly 8,000 calls; --cache-dir keeps every answer so an interrupted run resumes where it stopped.

Usage (from the repo root):
    python -m scripts.scrape_bellator --dry-run --cache-dir .bellator-cache
    python -m scripts.scrape_bellator --cache-dir .bellator-cache
    python -m scripts.scrape_bellator --photos --limit 3000
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_espn import ascii_name, clean_clock, clean_round, map_weight_class, name_key, save_csv
from scripts.scrape_pfl import FIGHT_FIELDS, FIGHTER_FIELDS, RANKING_FIELDS, normalize_method
from src.ufc_predictor.config import BASE_DIR, RAW_DATA_DIR
from src.ufc_predictor.countries import country_code, english_name

SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/mma/bellator/scoreboard"
CORE_URL = "https://sports.core.api.espn.com/v2/sports/mma/leagues/bellator"
ATHLETE_URL = "https://sports.core.api.espn.com/v2/sports/mma/athletes/{athlete_id}?lang=en"
ATHLETE_PAGE_URL = "https://www.espn.com/mma/fighter/_/id/{athlete_id}"
EVENT_PAGE_URL = "https://www.espn.com/mma/fightcenter/_/id/{event_id}/league/bellator"
CHAMPIONS_API = "https://en.wikipedia.org/w/api.php"
CHAMPIONS_PAGE = "List_of_Bellator_MMA_champions"

USER_AGENT = "FightIntelligenceBot/1.0 (+https://github.com/larissapavan; personal stats project; reads public ESPN JSON)"
OUTPUT_DIR = RAW_DATA_DIR / "bellator"
FIGHTS_PATH = OUTPUT_DIR / "fights.csv"
FIGHTERS_PATH = OUTPUT_DIR / "fighters.csv"
RANKINGS_PATH = OUTPUT_DIR / "rankings.csv"
PHOTOS_DIR = BASE_DIR / "frontend" / "public" / "fighter-photos" / "bellator"
PHOTOS_WEB_PREFIX = "/fighter-photos/bellator/"
PHOTO_MAX_WIDTH = 300
PHOTO_WEBP_METHOD = 4

FIRST_YEAR, LAST_YEAR = 2009, 2023
WORKERS = 4
REQUEST_DELAY_SECONDS = 0.25
TIMEOUT_SECONDS = 30
RETRIES = 3
AMERICAS = {"USA", "Canada", "Brazil", "Mexico"}
FINISHED_BY_DECISION = {"U-DEC", "S-DEC", "M-DEC"}


# --------------------------------------------------------------------------- fetching


class JsonFetcher:
    """GET JSON with a delay, retries and an optional on-disk cache. Safe to use from a few threads."""

    def __init__(self, delay: float = REQUEST_DELAY_SECONDS, cache_dir: Path | None = None) -> None:
        self.delay = delay
        self.cache_dir = cache_dir
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)

    def get(self, url: str, params: dict | None = None) -> dict:
        key = url + json.dumps(params or {}, sort_keys=True)
        cached = self.cache_dir / (hashlib.sha1(key.encode()).hexdigest()[:20] + ".json") if self.cache_dir else None
        if cached and cached.exists():
            return json.loads(cached.read_text(encoding="utf-8"))
        last_error: Exception | None = None
        for attempt in range(RETRIES):
            time.sleep(self.delay)
            try:
                response = self.session.get(url, params=params, timeout=TIMEOUT_SECONDS)
                if response.status_code == 404:
                    return {}
                response.raise_for_status()
                data = response.json()
                if cached:
                    cached.write_text(json.dumps(data), encoding="utf-8")
                return data
            except (requests.RequestException, ValueError) as error:
                last_error = error
                time.sleep(2 * (attempt + 1))
        raise RuntimeError(f"could not read {url}: {last_error}")


# --------------------------------------------------------------------------- ESPN


def event_day(raw_date: str, venue: dict | None) -> date:
    """ESPN dates are UTC; an evening card in the Americas falls on the next UTC day."""
    moment = datetime.strptime(raw_date[:16], "%Y-%m-%dT%H:%M")
    country = ((venue or {}).get("address") or {}).get("country", "")
    if country in AMERICAS and moment.hour < 9:
        moment -= timedelta(days=1)
    return moment.date()


def format_location(venue: dict | None) -> str:
    address = (venue or {}).get("address") or {}
    parts = [address.get("city", ""), address.get("state", "") if address.get("country") in {"USA", "Canada"} else "", address.get("country", "")]
    return ", ".join(part for part in parts if part)


def parse_events(payload: dict) -> list[dict]:
    """Events of a scoreboard answer with their bouts. The main event is first, as on the other organizations' cards."""
    events = []
    for raw in payload.get("events", []):
        venue = (raw.get("venues") or [None])[0]
        bouts = []
        for comp in raw.get("competitions", []):
            competitors = sorted(comp.get("competitors", []), key=lambda c: c.get("order", 0))
            if len(competitors) != 2 or not all("athlete" in c for c in competitors):
                continue
            names = [c["athlete"]["displayName"] for c in competitors]
            if any("TBA" in name.upper().split() for name in names):
                continue
            status = comp.get("status") or {}
            winners = [i for i, c in enumerate(competitors) if c.get("winner")]
            periods = (((comp.get("format") or {}).get("regulation") or {}).get("periods"))
            bouts.append(
                {
                    "competition_id": str(comp["id"]),
                    "fighters": [
                        {
                            "id": str(c["id"]),
                            "name": c["athlete"]["displayName"].strip(),
                            "flag": ((c["athlete"].get("flag") or {}).get("alt") or "").strip(),
                            "record": next((r.get("summary", "") for r in c.get("records") or []), ""),
                        }
                        for c in competitors
                    ],
                    "winner_index": winners[0] if winners else None,
                    "completed": bool((status.get("type") or {}).get("completed")),
                    "round": clean_round(status.get("period")),
                    "time": clean_clock(status.get("displayClock") or ""),
                    "scheduled_rounds": periods,
                }
            )
        if bouts:
            events.append(
                {
                    "id": str(raw["id"]),
                    "name": ascii_name(raw["name"]),
                    "day": event_day(raw["date"], venue),
                    "location": format_location(venue),
                    "bouts": list(reversed(bouts)),  # ESPN lists the prelims first
                }
            )
    return events


def bout_outcome(bout: dict, method: str) -> tuple[str, str]:
    """(winner name, outcome) for a bout: win, draw, no_contest, or nothing yet."""
    if bout["winner_index"] is not None:
        return bout["fighters"][bout["winner_index"]]["name"], "win"
    if not bout["completed"]:
        return "", ""
    return "", "draw" if method in FINISHED_BY_DECISION | {"Draw", "DEC"} else "no_contest"


def parse_bout_method(status: dict) -> tuple[str, str]:
    """ESPN status answer -> (method code, detail) in the UFC data's vocabulary; no result gives ("", "").

    ESPN's names changed over the years ("Decision - Unanimous", "Unanimous Decision", "TKO (Punches)", "KO/TKO"), so the
    readable name is parsed the way the PFL methods are."""
    result = status.get("result") if isinstance(status.get("result"), dict) else None
    text = ((result or {}).get("displayName") or "").strip()
    code, detail, _, _ = normalize_method(text)
    if code in FINISHED_BY_DECISION | {"DEC"}:  # "Decision - Majority (Draw)": the parenthesis is the outcome, not a detail
        detail = ""
    if not detail and " - " in text and code in {"KO/TKO", "SUB"}:
        detail = text.split(" - ", 1)[1].strip()
    return code, detail


def parse_athlete(data: dict) -> dict:
    """The profile fields ESPN has for a fighter."""
    if not data:
        return {}
    inches = lambda key: round(float(data[key]) * 2.54, 1) if data.get(key) else ""  # noqa: E731
    citizenship = data.get("citizenship") or ""
    code = country_code(citizenship) or ""
    association = data.get("association") or {}
    place = association.get("location") or {}
    return {
        "nickname": (data.get("nickname") or "").strip(),
        "age": data.get("age") or "",
        "height_cm": inches("height"),
        "weight_lbs": data.get("weight") or "",
        "reach_cm": inches("reach"),
        "country": english_name(code) or citizenship,
        "country_code": code,
        "camp": (association.get("name") or "").strip(),
        "fighting_out_of": ", ".join(part for part in (place.get("city"), place.get("country")) if part),
        "weight_class": map_weight_class((data.get("weightClass") or {}).get("text", "")),
        "headshot_url": ((data.get("headshot") or {}).get("href") or ""),
        "active": bool(data.get("active")),
    }


def parse_record(text: str) -> tuple[int, int, int, int] | None:
    found = re.match(r"(\d+)-(\d+)-(\d+)", text or "")
    return (int(found.group(1)), int(found.group(2)), int(found.group(3)), 0) if found else None


# --------------------------------------------------------------------------- Wikipedia champions

DATE_RE = r"[A-Z][a-z]{2} \d{1,2}, \d{4}"
DEFENSE_RE = re.compile(rf"(?:def\.|vs\.|draw with)\s+(?:interim champion\s+)?(.+?)\s+at\s+Bellator[^\n]*?\s+on\s+({DATE_RE})")
WON_RE = re.compile(r"^(.+?)\s+def\.\s+(.+?)(?:\s+for interim title)?$")
ENDED_RE = re.compile(r"vacated|stripped|retired|relinquish|released|left Bellator|suspended", re.IGNORECASE)


def parse_day(text: str) -> date | None:
    try:
        return datetime.strptime(text.strip(), "%b %d, %Y").date()
    except ValueError:
        return None


MONTH_DATE_RE = re.compile(r"(?:on|since)\s+([A-Z][a-z]+ \d{1,2}, \d{4})")


def compact_key(name: str) -> str:
    """'A. J. McKee' and 'AJ McKee' are the same fighter: initials joined, accents and order ignored."""
    return "".join(sorted(name_key(name).split()))


def ended_on(note: str) -> date | None:
    """When a note says the title was vacated, stripped or left behind, the date it gives (None when it gives none)."""
    if not ENDED_RE.search(note):
        return None
    found = MONTH_DATE_RE.search(note)
    try:
        return datetime.strptime(found.group(1), "%B %d, %Y").date() if found else date.min
    except ValueError:
        return date.min


def parse_reigns(html: str) -> list[dict]:
    """Every title reign: division, champion, interim?, start date, the fights that make it (the win and the defenses)
    and the date it ended by vacating or stripping, when a note says so.

    A table belongs to the nearest heading above it; a division with no table (men's flyweight) simply has no reigns."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["style", "sup"]):
        tag.decompose()
    reigns: list[dict] = []
    for table in soup.find_all("table", class_="wikitable"):
        heading = table.find_previous(["h2", "h3"])
        match = re.match(r"(.+?) World Championship$", heading.get_text(" ", strip=True)) if heading else None
        if not match:
            continue
        division = map_weight_class(match.group(1).strip())
        previous: dict | None = None
        for row in table.find_all("tr")[1:]:
            cells = [cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"])]
            if len(cells) == 1 and previous is not None:  # a note under the reign ("X vacated the title on...")
                previous["ended"] = previous["ended"] or ended_on(cells[0])
                continue
            if len(cells) < 4 or not parse_day(cells[3]):
                continue
            name_text, day, defenses = cells[1], parse_day(cells[3]), cells[5] if len(cells) > 5 else ""
            interim = "for interim title" in name_text.lower()
            won = WON_RE.match(name_text)
            champion = re.sub(r"\s*\(\d+\)$", "", (won.group(1) if won else re.sub(r"\s+for interim title$", "", name_text)).strip())
            fights = [(day, champion, re.sub(r"^interim champion\s+", "", won.group(2).strip()))] if won else []
            for opponent, when in DEFENSE_RE.findall(defenses):
                if parse_day(when):
                    fights.append((parse_day(when), champion, opponent.strip()))
            previous = {"division": division, "champion": champion, "interim": interim, "start": day, "ended": ended_on(defenses), "fights": fights}
            reigns.append(previous)
    return reigns


def final_champions(reigns: list[dict], cutoff: date) -> list[dict]:
    """rankings.csv rows: the champion each division had when Bellator ended (rank 0), vacant when that reign had already
    ended, and the interim champion when one was still holding the interim belt. Reigns after the cutoff belong to the PFL era."""
    rows = []
    divisions: list[str] = []
    for reign in reigns:
        if reign["division"] not in divisions:
            divisions.append(reign["division"])
    for division in divisions:
        held = [reign for reign in reigns if reign["division"] == division and reign["start"] <= cutoff]
        champions = [reign for reign in held if not reign["interim"]]
        if not champions:
            continue
        champion = champions[-1]
        over = lambda reign: reign["ended"] is not None and reign["ended"] <= cutoff  # noqa: E731
        rows.append(_ranking_row(division, "" if over(champion) else champion["champion"], "vacant" if over(champion) else "champion"))
        rows += [_ranking_row(division, reign["champion"], "interim") for reign in held if reign["interim"] and reign["start"] > champion["start"] and not over(reign)]
    return rows


def _ranking_row(category: str, fighter: str, status: str) -> dict:
    return {"category": category, "is_p4p": False, "rank": 0, "fighter": fighter, "rank_change": "", "status": status, "athlete_url": ""}


def mark_title_fights(fights: list[dict], reigns: list[dict]) -> int:
    """Flag the bouts that were title fights (and give them their division) from the reigns' first fights and defenses."""
    titles: dict[frozenset[str], list[tuple[date, str, bool]]] = {}
    for reign in reigns:
        for day, champion, opponent in reign["fights"]:
            titles.setdefault(frozenset((compact_key(champion), compact_key(opponent))), []).append((day, reign["division"], reign["interim"]))
    marked = 0
    for fight in fights:
        pair = frozenset((compact_key(fight["fighter_1"]), compact_key(fight["fighter_2"])))
        fight_day = date.fromisoformat(fight["event_date"])
        for day, division, interim in titles.get(pair, []):
            if abs((fight_day - day).days) <= 1:
                fight["title_fight"] = "true"
                fight["weight_class"] = division
                fight["stage"] = "Interim World Title" if interim else "World Title"
                marked += 1
                break
    return marked


# --------------------------------------------------------------------------- assembling


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", ascii_name(name).lower()).strip("-")


def fight_rows(events: list[dict], methods: dict[str, tuple[str, str]]) -> list[dict]:
    rows = []
    for event in events:
        for order, bout in enumerate(event["bouts"]):
            method, detail = methods.get(bout["competition_id"], ("", ""))
            winner, outcome = bout_outcome(bout, method)
            one, two = bout["fighters"]
            rows.append(
                {
                    "event_name": event["name"], "event_date": event["day"].isoformat(), "location": event["location"],
                    "event_url": EVENT_PAGE_URL.format(event_id=event["id"]), "event_slug": f"bellator-{event['id']}",
                    "circuit": "", "fight_url": f"{EVENT_PAGE_URL.format(event_id=event['id'])}#fight-{bout['competition_id']}",
                    "card_order": order, "fighter_1": one["name"], "fighter_2": two["name"],
                    "fighter_1_url": ATHLETE_PAGE_URL.format(athlete_id=one["id"]), "fighter_2_url": ATHLETE_PAGE_URL.format(athlete_id=two["id"]),
                    "winner": winner, "outcome": outcome, "weight_class": "", "stage": "", "title_fight": "",
                    "method": method if outcome else "", "method_detail": detail if outcome else "",
                    "round": bout["round"].split(".")[0] if outcome and bout["round"] else "", "time": bout["time"] if outcome else "",
                }
            )
    return rows


def fill_weight_classes(fights: list[dict], bios: dict[str, dict], ids_by_name: dict[str, str]) -> int:
    """Bouts with no division take the one both fighters' ESPN profiles name. Returns how many it filled."""
    filled = 0
    for fight in fights:
        if fight["weight_class"]:
            continue
        first = bios.get(ids_by_name.get(name_key(fight["fighter_1"]), ""), {}).get("weight_class")
        second = bios.get(ids_by_name.get(name_key(fight["fighter_2"]), ""), {}).get("weight_class")
        if first and first == second:
            fight["weight_class"] = first
            filled += 1
    return filled


def propagate_weight_classes(fights: list[dict]) -> int:
    """Bouts still without a division take their fighters' usual one: the one both usually fight at, or the only one known
    when it is at least 80% of that fighter's known bouts. Returns how many bouts it filled."""
    usual: dict[str, dict[str, int]] = {}
    for fight in fights:
        if fight["weight_class"]:
            for side in ("fighter_1", "fighter_2"):
                votes = usual.setdefault(name_key(fight[side]), {})
                votes[fight["weight_class"]] = votes.get(fight["weight_class"], 0) + 1

    def top(name: str) -> str | None:
        votes = usual.get(name_key(name), {})
        total = sum(votes.values())
        best = max(votes, key=votes.get) if votes else None
        return best if best and votes[best] / total >= 0.8 else None

    filled = 0
    for fight in fights:
        if fight["weight_class"]:
            continue
        first, second = top(fight["fighter_1"]), top(fight["fighter_2"])
        division = first if first == second else first or second if not (first and second) else None
        if division:
            fight["weight_class"] = division
            filled += 1
    return filled


def fighter_rows(fighters: dict[str, dict], bios: dict[str, dict], fights: list[dict], today: str) -> list[dict]:
    dates: dict[str, list[str]] = {}
    for fight in fights:
        for side in ("fighter_1", "fighter_2"):
            dates.setdefault(name_key(fight[side]), []).append(fight["event_date"])
    taken: set[str] = set()
    rows = []
    for athlete_id, info in sorted(fighters.items(), key=lambda item: ascii_name(item[1]["name"]).lower()):
        bio = bios.get(athlete_id, {})
        slug = slugify(info["name"])
        slug = slug if slug not in taken else f"{slug}-{athlete_id}"
        taken.add(slug)
        record = parse_record(info["record"])
        own = sorted(dates.get(name_key(info["name"]), []))
        rows.append(
            {
                "name": info["name"], "slug": slug, "profile_url": ATHLETE_PAGE_URL.format(athlete_id=athlete_id), "circuit": "",
                "nickname": bio.get("nickname", ""), "status": "active" if bio.get("active") else "inactive",
                "career_record": info["record"], "org_record": "",
                "wins": record[0] if record else "", "losses": record[1] if record else "", "draws": record[2] if record else "", "no_contests": "",
                "age": bio.get("age", ""), "height_cm": bio.get("height_cm", ""), "weight_lbs": bio.get("weight_lbs", ""),
                "reach_cm": bio.get("reach_cm", ""), "leg_reach_cm": "", "hometown": "",
                "country": bio.get("country") or english_name(country_code(info["flag"]) or "") or info["flag"],
                "country_code": bio.get("country_code") or country_code(info["flag"]) or "",
                "fighting_out_of": bio.get("fighting_out_of", ""), "camp": bio.get("camp", ""),
                "weight_class": bio.get("weight_class", ""), "headshot_url": bio.get("headshot_url", ""), "image_url": "",
                "first_fight_date": own[0] if own else "", "last_fight_date": own[-1] if own else "", "checked": today,
            }
        )
    return rows


def attach_local_photos(rows: list[dict]) -> None:
    for row in rows:
        row["image_url"] = f"{PHOTOS_WEB_PREFIX}{row['slug']}.webp" if (PHOTOS_DIR / f"{row['slug']}.webp").exists() else ""


def download_photos(rows: list[dict], limit: int, delay: float) -> int:
    from scripts.download_fighter_photos import to_webp

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    done = 0
    for row in rows:
        target = PHOTOS_DIR / f"{row['slug']}.webp"
        if row["headshot_url"] and not target.exists() and done < limit:
            try:
                time.sleep(delay)
                response = session.get(row["headshot_url"], timeout=TIMEOUT_SECONDS)
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                target.write_bytes(to_webp(response.content, max_width=PHOTO_MAX_WIDTH, method=PHOTO_WEBP_METHOD))
                done += 1
            except Exception as error:  # noqa: BLE001 - a missing photo must not stop the run
                print(f"[warn] photo for {row['name']}: {error}")
    return done


# --------------------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="read and report, write nothing")
    parser.add_argument("--photos", action="store_true", help="download headshots as WebP into frontend/public/fighter-photos/bellator")
    parser.add_argument("--limit", type=int, default=3000, help="max photos to download in one run")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY_SECONDS)
    parser.add_argument("--cache-dir", type=Path, help="keep every answer here so an interrupted run resumes")
    args = parser.parse_args(argv)

    fetcher = JsonFetcher(delay=args.delay, cache_dir=args.cache_dir)
    events: list[dict] = []
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        events += parse_events(fetcher.get(SCOREBOARD_URL, {"dates": f"{year}0101-{year}1231", "limit": 500}))
    events.sort(key=lambda event: (event["day"], event["id"]), reverse=True)
    bouts = [(event, bout) for event in events for bout in event["bouts"]]
    print(f"[info] {len(events)} events, {len(bouts)} bouts")
    if not events:
        print("[error] no events; files left untouched")
        return 1

    def method_of(item: tuple[dict, dict]) -> tuple[str, tuple[str, str]]:
        event, bout = item
        if not bout["completed"]:
            return bout["competition_id"], ("", "")
        status = fetcher.get(f"{CORE_URL}/events/{event['id']}/competitions/{bout['competition_id']}/status?lang=en")
        return bout["competition_id"], parse_bout_method(status)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        methods = dict(pool.map(method_of, bouts))
    print(f"[info] {sum(1 for m in methods.values() if m[0])} bouts with a method")

    fighters: dict[str, dict] = {}
    for _, bout in bouts:
        for fighter in bout["fighters"]:
            fighters.setdefault(fighter["id"], fighter)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        bios = dict(zip(fighters, pool.map(lambda athlete_id: parse_athlete(fetcher.get(ATHLETE_URL.format(athlete_id=athlete_id))), fighters)))
    print(f"[info] {len(fighters)} fighters, {sum(1 for b in bios.values() if b)} profiles")

    reigns = parse_reigns(fetcher.get(CHAMPIONS_API, {"action": "parse", "page": CHAMPIONS_PAGE, "prop": "text", "format": "json"}).get("parse", {}).get("text", {}).get("*", ""))
    rankings = final_champions(reigns, max(event["day"] for event in events))
    fights = fight_rows(events, methods)
    marked = mark_title_fights(fights, reigns)
    ids_by_name = {name_key(info["name"]): athlete_id for athlete_id, info in fighters.items()}
    filled = fill_weight_classes(fights, bios, ids_by_name)
    spread = propagate_weight_classes(fights)
    print(f"[info] {len(reigns)} title reigns, {marked} title bouts flagged, weight class from the profiles for {filled} bouts and from the fighters' other bouts for {spread}")

    rows = fighter_rows(fighters, bios, fights, date.today().isoformat())
    if args.photos and not args.dry_run:
        print(f"[info] photos downloaded: {download_photos(rows, args.limit, args.delay)}")
    attach_local_photos(rows)
    print(f"[info] {len(fights)} bouts, {len(rows)} fighters, {len(rankings)} ranking rows")
    if args.dry_run:
        print("[dry-run] nothing written")
        return 0
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    save_csv(FIGHTS_PATH, FIGHT_FIELDS, fights)
    save_csv(FIGHTERS_PATH, FIGHTER_FIELDS, rows)
    save_csv(RANKINGS_PATH, RANKING_FIELDS, rankings)
    return 0


if __name__ == "__main__":
    sys.exit(main())
