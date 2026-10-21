"""Scrape the Professional Fighters League (PFL) events, fights, fighters and rankings from pflmma.com.

Only the public, server-rendered pages that pflmma.com/robots.txt allows are read: the events list and sitemap, one
page per event, one page per fighter and the rankings. The site's /ajax/ and /smt/ endpoints (which load the live fight
card and the stats) are disallowed in robots.txt and are never called.

What each page gives:
- event page   JSON-LD with the name, venue, every pairing, the winner and a coarse method ("by Decision"); the visible
               header has the real local date (the JSON-LD date is a day late for the older events).
- fighter page profile (record, age, height, reach, country, camp, photo) and every fight of that fighter with its
               weight class, stage (Semifinal, Championship...), method, round and time.
- rankings     the champions (vacant, interim) and the top 10 of each division and the men's pound-for-pound.

Output (data/raw/pfl/):
    fights.csv    one row per bout, announced or fought, with the event on every row
    fighters.csv  one row per fighter
    rankings.csv  same layout as data/raw/rankings.csv (rank 0 = champion) plus the title status

The first run reads about 1,400 fighter pages (about 15 minutes at the default delay). Later runs only re-read events
of the last REFRESH_DAYS days and upcoming ones, the fighters on them, new fighters and the ranked ones.

Usage (from the repo root):
    python -m scripts.scrape_pfl --dry-run              # parse and report, write nothing
    python -m scripts.scrape_pfl                        # incremental refresh
    python -m scripts.scrape_pfl --full                 # re-read every event and fighter page
    python -m scripts.scrape_pfl --photos --limit 300   # also download headshots as small WebP files
    python -m scripts.scrape_pfl --cache-dir .pfl-cache # keep downloaded pages, so an interrupted run can resume
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.scrape_espn import ascii_name, load_csv, name_key, save_csv
from src.ufc_predictor.config import BASE_DIR, RAW_DATA_DIR
from src.ufc_predictor.countries import country_code, english_name

BASE_URL = "https://pflmma.com"
EVENTS_URL = f"{BASE_URL}/events"
SITEMAP_URL = f"{BASE_URL}/sitemap.xml"
RANKINGS_URL = f"{BASE_URL}/rankings"

OUTPUT_DIR = RAW_DATA_DIR / "pfl"
FIGHTS_PATH = OUTPUT_DIR / "fights.csv"
FIGHTERS_PATH = OUTPUT_DIR / "fighters.csv"
RANKINGS_PATH = OUTPUT_DIR / "rankings.csv"
PHOTOS_DIR = BASE_DIR / "frontend" / "public" / "fighter-photos" / "pfl"
PHOTOS_WEB_PREFIX = "/fighter-photos/pfl/"

USER_AGENT = "FightIntelligenceBot/1.0 (+https://github.com/larissapavan; personal stats project)"
REQUEST_DELAY_SECONDS = 0.5
TIMEOUT_SECONDS = 30
RETRIES = 3
# Events fought inside this window are read again (late result edits, method corrections).
REFRESH_DAYS = 45
PHOTO_MAX_WIDTH = 300
# libwebp's slowest setting (6) takes seconds on these transparent PNGs for a few percent less size; 4 takes milliseconds.
PHOTO_WEBP_METHOD = 4

FIGHT_FIELDS = [
    "event_name", "event_date", "location", "event_url", "event_slug", "circuit", "fight_url", "card_order",
    "fighter_1", "fighter_2", "fighter_1_url", "fighter_2_url", "winner", "outcome",
    "weight_class", "stage", "title_fight", "method", "method_detail", "round", "time",
]
FIGHTER_FIELDS = [
    "name", "slug", "profile_url", "circuit", "nickname", "status", "career_record", "org_record",
    "wins", "losses", "draws", "no_contests", "age", "height_cm", "weight_lbs", "reach_cm", "leg_reach_cm",
    "hometown", "country", "country_code", "fighting_out_of", "camp", "weight_class", "headshot_url", "image_url",
    "first_fight_date", "last_fight_date", "checked",
]
RANKING_FIELDS = ["category", "is_p4p", "rank", "fighter", "rank_change", "status", "athlete_url"]

# profile URL family -> where the fighter competes
CIRCUITS = {
    "regular-fighter": "PFL",
    "wt-fighter": "PFL",
    "cs-fighter": "PFL Champions Series",
    "challenger-fighter": "PFL Challenger Series",
    "europe-fighter": "PFL Europe",
    "mena-fighter": "PFL MENA",
    "africa-fighter": "PFL Africa",
    "superfights-fighter": "PFL Super Fights",
}

# Longest first, so "Light Heavyweight" is not read as "Heavyweight" with a stage in front.
DIVISIONS = [
    "Women's Atomweight", "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight", "Women's Featherweight", "Women's Lightweight",
    "Light Heavyweight", "Super Heavyweight", "Atomweight", "Flyweight", "Bantamweight", "Featherweight", "Lightweight",
    "Welterweight", "Middleweight", "Heavyweight", "Contract Weight", "Catchweight", "Catch Weight", "Open Weight",
]
TITLE_STAGE = re.compile(r"\b(championship|world title|finals?)\b", re.IGNORECASE)
IMAGE_PLACEHOLDER = re.compile(r"/default[-_a-z]*\.(?:png|jpg|webp)$", re.IGNORECASE)

MONTHS = {name: number for number, name in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split(), 1)}
DATE_PATTERN = re.compile(
    r"\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?", re.IGNORECASE
)


# --------------------------------------------------------------------------- fetching


class Fetcher:
    """GET with a delay between requests, a few retries and an optional on-disk page cache."""

    def __init__(self, delay: float = REQUEST_DELAY_SECONDS, cache_dir: Path | None = None) -> None:
        self.delay = delay
        self.cache_dir = cache_dir
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.requests_made = 0
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_path(self, url: str) -> Path | None:
        if not self.cache_dir:
            return None
        return self.cache_dir / (hashlib.sha1(url.encode()).hexdigest()[:20] + ".html")

    def get(self, url: str) -> str:
        cached = self._cache_path(url)
        if cached and cached.exists():
            return cached.read_text(encoding="utf-8")
        last_error: Exception | None = None
        for attempt in range(RETRIES):
            if self.requests_made:
                time.sleep(self.delay)
            self.requests_made += 1
            try:
                response = self.session.get(url, timeout=TIMEOUT_SECONDS)
                if response.status_code in (404, 410):  # a page the site links to but does not have: retrying will not help
                    raise RuntimeError(f"{url}: HTTP {response.status_code}")
                if response.status_code == 429:
                    time.sleep(10 * (attempt + 1))
                    last_error = RuntimeError(f"{url}: HTTP 429")
                    continue
                response.raise_for_status()
                response.encoding = "utf-8"
                if cached:
                    cached.write_text(response.text, encoding="utf-8")
                return response.text
            except requests.RequestException as error:
                last_error = error
                time.sleep(2 * (attempt + 1))
            except RuntimeError:
                raise
        raise RuntimeError(f"could not read {url}: {last_error}")


# --------------------------------------------------------------------------- small parsers


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def clean_nickname(text: str | None) -> str:
    """Nicknames come as "MAGIC" (quoted, in capitals) or as a placeholder ("Nickname"); the first is tidied, the second dropped."""
    nickname = clean(text).strip("\"'“”‘’ ")
    if nickname.lower() in {"nickname", "n/a", "na", "none", "tbd", "-"}:
        return ""
    return nickname.title() if nickname.isupper() and len(nickname) > 3 else nickname


def slug_of(url: str) -> str:
    return urlparse(url).path.rstrip("/").rsplit("/", 1)[-1]


def family_of(url: str) -> str:
    parts = urlparse(url).path.strip("/").split("/")
    return parts[0] if len(parts) > 1 else ""


def split_division(label: str) -> tuple[str, str]:
    """'Heavyweight Quarterfinal (265)' -> ('Heavyweight', 'Quarterfinal'); 'Light Heavyweight (205)' -> ('Light Heavyweight', '')."""
    text = clean(re.sub(r"\(\s*[\d.]+\s*\)", " ", label))
    text = re.sub(r"^PFL\s+", "", text)
    for division in DIVISIONS:
        found = re.search(re.escape(division), text, re.IGNORECASE)
        if found:
            stage = clean((text[: found.start()] + " " + text[found.end() :]).replace("  ", " "))
            # The site types some stages in capitals ("AMATEUR"); a mixed-case one ("1st Round") is left as written.
            return ("Catchweight" if division == "Catch Weight" else division), stage.title() if stage.isupper() else stage
    return text[:1].upper() + text[1:], ""


def is_title_stage(stage: str) -> bool:
    return bool(TITLE_STAGE.search(stage))


def parse_round_time(text: str) -> tuple[int | None, str]:
    """'R5, 5:00' / 'Rd 2 (4:07)' / 'Round 3 - 5:00' / '(5:00)' -> (round, time)."""
    found_round = re.search(r"\bR(?:d|ound)?\s*(\d)\b", text, re.IGNORECASE)
    found_time = re.search(r"\b(\d{1,2}:\d{2})\b", text)
    return (int(found_round.group(1)) if found_round else None, found_time.group(1) if found_time else "")


def normalize_method(text: str) -> tuple[str, str, int | None, str]:
    """Free-text method -> (code, detail, round, time) using the same codes as the UFC data (U-DEC, KO/TKO, SUB...).

    'TKO Round 3 - 4:07' -> ('KO/TKO', '', 3, '4:07'); 'Submission (Armbar)' -> ('SUB', 'Armbar', None, '')."""
    raw = clean(text)
    if raw.isdigit():  # the site sometimes types the round where the method goes
        return "", "", int(raw) if int(raw) < 10 else None, ""
    round_number, time_text = parse_round_time(raw)
    base = clean(re.sub(r"\bR(?:d|ound)?\s*\d\b.*$", "", raw, flags=re.IGNORECASE))
    detail_match = re.search(r"\(([^)]*)\)", base)
    detail = clean(detail_match.group(1)) if detail_match else ""
    lowered = re.sub(r"\([^)]*\)", "", base).lower()
    if not lowered:
        return "", "", round_number, time_text

    if "unanimous" in lowered:
        code = "U-DEC"
    elif "split" in lowered:
        code = "S-DEC"
    elif "majority" in lowered:
        code = "M-DEC"
    elif "decision" in lowered or (len(lowered) >= 2 and "decision".startswith(lowered)):
        code = "DEC"
    elif re.search(r"\b(ko|tko|knockout|stoppage|ko/tko|retirement|corner)\b", lowered) or "doctor" in lowered:
        code = "KO/TKO"
    elif re.search(r"submi|choke|armbar|triangle|kimura|guillotine|lock\b", lowered):
        code = "SUB"
        if not detail and not lowered.startswith("sub"):
            detail = clean(base.title())
    elif re.search(r"walkover|forfeit|withdr", lowered):
        code = "Walkover"
    elif re.search(r"\bdq\b|disqualif", lowered):
        code = "DQ"
    elif "no contest" in lowered or lowered == "nc":
        code = "NO CONTEST"
    elif "draw" in lowered:
        code = "Draw"
    else:  # a typo or a name typed in the wrong box: no method is better than a wrong one
        code, detail = "", ""
    return code, detail, round_number, time_text


def parse_record(text: str) -> tuple[int, int, int, int] | None:
    """'25-8-0' / '25-7-1 (1 NC)' -> (wins, losses, draws, no_contests)."""
    found = re.search(r"(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?", text or "")
    if not found:
        return None
    no_contests = re.search(r"(\d+)\s*NC", text or "", re.IGNORECASE)
    return int(found.group(1)), int(found.group(2)), int(found.group(3) or 0), int(no_contests.group(1)) if no_contests else 0


def parse_height_cm(text: str) -> float | None:
    found = re.search(r"(\d)\s*['’]\s*(\d{1,2})?", text or "")
    if not found:
        return None
    return round((int(found.group(1)) * 12 + int(found.group(2) or 0)) * 2.54, 1)


def parse_inches_cm(text: str) -> float | None:
    found = re.search(r"(\d+(?:\.\d+)?)", text or "")
    return round(float(found.group(1)) * 2.54, 1) if found else None


def parse_number(text: str) -> float | None:
    found = re.search(r"(\d+(?:\.\d+)?)", text or "")
    return float(found.group(1)) if found else None


def pair_key(name_a: str, name_b: str) -> frozenset[str]:
    return frozenset((name_key(name_a), name_key(name_b)))


# --------------------------------------------------------------------------- events


def parse_event_links(html: str) -> list[str]:
    """Event slugs linked from the events page or listed in the sitemap, in page order."""
    slugs: list[str] = []
    for found in re.finditer(r"/event/([A-Za-z0-9_-]+)(?=[\"'<\s?#/]|$)", html):
        if found.group(1) not in slugs:
            slugs.append(found.group(1))
    return slugs


def _json_ld_event(soup: BeautifulSoup) -> dict | None:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except json.JSONDecodeError:
            continue
        for node in data.get("@graph", [data]) if isinstance(data, dict) else []:
            if node.get("@type") == "SportsEvent" and "/event/" in str(node.get("url", "")):
                return node
    return None


def visible_event_date(soup: BeautifulSoup, near: date | None) -> date | None:
    """The date printed in the page header. Older events print a year ('Thursday Jun 7, 2018'); newer ones do not, so
    the year is the one that puts the date closest to the JSON-LD date."""
    body = soup.body or soup
    for tag in body(["script", "style", "svg"]):
        tag.decompose()
    text = body.get_text("\n", strip=True)
    start = text.find("EVENT INFO")
    found = DATE_PATTERN.search(text[start : start + 600] if start >= 0 else text[:2000])
    if not found:
        return None
    month, day = MONTHS.get(found.group(1).lower()), int(found.group(2))
    if not month:
        return None
    years = [int(found.group(3))] if found.group(3) else [(near.year + shift) if near else date.today().year for shift in (-1, 0, 1)]
    candidates = []
    for year in years:
        try:
            candidates.append(date(year, month, day))
        except ValueError:
            continue
    if not candidates:
        return None
    return min(candidates, key=lambda candidate: abs((candidate - near).days)) if near else candidates[0]


def parse_fight_description(description: str, fighter_1: str, fighter_2: str) -> dict:
    """JSON-LD fight description: 'Winner: A by Decision', 'Winner: A' or 'A vs B - Welterweight Semifinal'."""
    text = clean(description)
    result = {"winner": "", "outcome": "", "method": "", "method_detail": "", "round": None, "time": "", "weight_class": "", "stage": ""}
    won = re.match(r"Winner:\s*(.+?)(?:\s+by\s+(.*))?$", text, re.IGNORECASE)
    if won:
        names = {name_key(fighter_1): fighter_1, name_key(fighter_2): fighter_2}
        result["winner"] = names.get(name_key(won.group(1)), "")
        result["outcome"] = "win" if result["winner"] else ""
        code, detail, round_number, time_text = normalize_method(won.group(2) or "")
        result.update(method=code, method_detail=detail, round=round_number, time=time_text)
        return result
    if re.match(r"(draw|no contest)", text, re.IGNORECASE):
        code, *_ = normalize_method(text)
        result.update(outcome="draw" if code == "Draw" else "no_contest", method=code)
        return result
    label = text.split(" - ", 1)[1] if " - " in text else ""
    if label:
        result["weight_class"], result["stage"] = split_division(label)
    return result


def parse_event_page(html: str, url: str) -> dict | None:
    """One event with all its bouts, or None when the page has no event data."""
    soup = BeautifulSoup(html, "html.parser")
    node = _json_ld_event(soup)
    if node is None:
        return None
    try:
        json_date = date.fromisoformat(str(node.get("startDate", ""))[:10])
    except ValueError:
        json_date = None
    event_date = visible_event_date(BeautifulSoup(html, "html.parser"), json_date) or json_date
    if event_date is None:
        return None

    slug = slug_of(url)
    location = clean((node.get("location") or {}).get("name") or node.get("description"))
    fights: list[dict] = []
    for index, sub in enumerate(node.get("subEvent", [])):
        competitors = sub.get("competitor", [])
        if len(competitors) != 2:
            continue
        fighter_1, fighter_2 = clean(competitors[0]["name"]), clean(competitors[1]["name"])
        fight = {
            "fighter_1": fighter_1,
            "fighter_2": fighter_2,
            "fighter_1_url": competitors[0].get("url", ""),
            "fighter_2_url": competitors[1].get("url", ""),
            "fight_url": str(sub.get("@id") or f"{url}#bout-{index}"),
            **parse_fight_description(sub.get("description", ""), fighter_1, fighter_2),
        }
        fights.append(fight)

    families = Counter(
        family_of(fight[key]) for fight in fights for key in ("fighter_1_url", "fighter_2_url") if family_of(fight[key]) in CIRCUITS
    )
    circuit = CIRCUITS[families.most_common(1)[0][0]] if families else ""
    return {
        "slug": slug,
        "name": clean(node.get("name")),
        "date": event_date,
        "location": location,
        "url": url,
        "circuit": circuit,
        "fights": fights,
    }


# --------------------------------------------------------------------------- fighters


def _text_after(soup: BeautifulSoup, label: str) -> str:
    """'FROM <span>USA</span>' style blocks: the span text of the heading that starts with the label."""
    for heading in soup.find_all(["h4", "h3"]):
        own = clean(heading.find(string=True, recursive=False))
        if own.upper().startswith(label):
            span = heading.find("span")
            return clean(span.get_text()) if span else ""
    return ""


def _info_box(soup: BeautifulSoup, label: str) -> str:
    for box in soup.select(".fighter-info-box"):
        caption = box.find("h4")
        if caption and clean(caption.get_text()).upper() == label:
            value = box.find("h3")
            return clean(value.get_text()) if value else ""
    return ""


def parse_fighter_fight_rows(soup: BeautifulSoup, last_name: str) -> list[dict]:
    """The fights listed on a fighter page, each tied to its event page and opponent."""
    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    own = name_key(last_name)
    for row in soup.select("div.upcoming-fighter-row"):
        link = row.select_one("a[href*='/event/']")
        if link is None:
            continue
        event_slug = slug_of(link["href"])
        sides = [clean(h.get_text()) for h in row.select("h4.d-md-none") if clean(h.get_text()) and clean(h.get_text()).upper() != "VS"]
        if len(sides) < 2:
            sides = [clean(h.get_text()) for h in row.select("h4") if clean(h.get_text())]
        opponents = [side for side in sides if name_key(side) != own] or sides[-1:]
        opponent = opponents[0] if opponents else ""
        if (event_slug, name_key(opponent)) in seen:
            continue
        seen.add((event_slug, name_key(opponent)))
        headings = [clean(h.get_text(" ")) for h in row.select("h5")]
        weight_class, stage = split_division(headings[1] if len(headings) > 1 else "")
        method_text = clean(" ".join(w.get_text(" ") for w in row.select(".winBy")[:1]))
        round_text = clean(" ".join(w.get_text(" ") for w in row.select(".roundTime")[:1]))
        code, detail, round_a, time_a = normalize_method(method_text)
        round_b, time_b = parse_round_time(round_text)
        rows.append(
            {
                "event_slug": event_slug,
                "opponent_surname": opponent,
                "weight_class": weight_class,
                "stage": stage,
                "method": code,
                "method_detail": detail,
                "round": round_b or round_a,
                "time": time_b or time_a,
                "images": [img.get("src", "") for img in row.select("img[alt='Fighter Headshot']")][:2],
                "left_surname": sides[0] if sides else "",
            }
        )
    return rows


def parse_fighter_page(html: str, url: str) -> dict | None:
    """A fighter profile plus his or her fight rows; None when the page is not a fighter profile."""
    soup = BeautifulSoup(html, "html.parser")
    title = soup.find("meta", property="og:title")
    name = clean((title or {}).get("content", "")).split("|")[0].strip() if title else ""
    banner = soup.select_one(".fighter-dl-inner")
    if not name or banner is None:
        return None

    last_name = clean(banner.find("h2").get_text()) if banner.find("h2") else name.split()[-1]
    nickname_tag = banner.select_one("h4.mt-2")
    records = {clean(h.get_text()).split(":")[0]: clean(h.get_text()).split(":", 1)[1] for h in banner.find_all("h4") if ":" in h.get_text()}
    career = parse_record(records.get("Career Record", ""))
    flag = soup.select_one("img[src*='/flags/backdrops/']")
    flag_match = re.search(r"/([A-Za-z-]+)_BACKDROP", flag.get("src", "")) if flag else None
    hometown = _text_after(soup, "FROM")
    code = (flag_match.group(1).lower() if flag_match else "") or country_code(hometown) or ""
    page_text = soup.get_text(" ", strip=True)
    fight_rows = parse_fighter_fight_rows(soup, last_name)
    headshot = own_headshot(fight_rows, last_name)
    height_text = _info_box(soup, "HEIGHT")

    return {
        "profile": {
            "name": name,
            "slug": slug_of(url),
            "profile_url": url,
            "circuit": CIRCUITS.get(family_of(url), ""),
            "nickname": clean_nickname(nickname_tag.get_text()) if nickname_tag else "",
            "status": "inactive" if "NOT FIGHTING" in page_text else "active",
            "career_record": clean(records.get("Career Record", "")),
            "org_record": clean(records.get("PFL Record", "")),
            "wins": career[0] if career else "",
            "losses": career[1] if career else "",
            "draws": career[2] if career else "",
            "no_contests": career[3] if career else "",
            "age": parse_number(_info_box(soup, "AGE")) or "",
            "height_cm": parse_height_cm(height_text) or "",
            "weight_lbs": parse_number(_info_box(soup, "WEIGHT")) or "",
            "reach_cm": parse_inches_cm(_info_box(soup, "ARM REACH")) or "",
            "leg_reach_cm": parse_inches_cm(_info_box(soup, "LEG REACH")) or "",
            "hometown": hometown,
            "country": english_name(code) or "",
            "country_code": code,
            "fighting_out_of": _text_after(soup, "FIGHTING OUT OF"),
            "camp": _text_after(soup, "FIGHT CAMP"),
            "weight_class": fight_rows[0]["weight_class"] if fight_rows else split_division(_division_header(soup))[0],
            "headshot_url": headshot,
        },
        "last_name": last_name,
        "fights": fight_rows,
    }


def own_headshot(rows: list[dict], last_name: str) -> str:
    """The fighter's own photo from the fight rows, which show both fighters.

    The fighter is in every row while opponents are not, so the most repeated image is the fighter's. Rows where the
    two surnames differ also tell which side is the fighter, which settles a profile with a single fight."""
    own = name_key(last_name)
    counts: Counter[str] = Counter()
    for row in rows:
        images = row.get("images", [])
        if len(images) != 2:
            continue
        sides = [name_key(row["left_surname"]), name_key(row["opponent_surname"])]
        if sides[0] != sides[1] and own in sides:
            side_image = images[0] if sides[0] == own else images[1]
        else:
            continue
        counts[side_image] += 1
    if not counts:
        counts.update(image for row in rows for image in row.get("images", []))
    for image, _ in counts.most_common():
        if image and not IMAGE_PLACEHOLDER.search(image):
            return image
    return ""


def _division_header(soup: BeautifulSoup) -> str:
    """Regular-season profiles print 'Heavyweight (265)' under the name."""
    for heading in soup.select(".fighter-dl-inner h4, .fighter-dl-inner h5, .fighter-dl-inner h3"):
        text = clean(heading.get_text())
        if re.search(r"\(\s*\d+\s*\)", text):
            return text
    return ""


# --------------------------------------------------------------------------- rankings


def parse_rankings(html: str) -> list[dict]:
    """Rows in the layout of data/raw/rankings.csv: rank 0 is the champion, with status champion/interim/vacant."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for box in soup.select(".rankings-box"):
        heading = box.select_one(".ranking-title h5")
        if heading is None:
            continue
        title = clean(heading.get_text())
        is_p4p = "P4P" in title.upper()
        category = "Pound-for-Pound (Men's)" if is_p4p and "MEN" in title.upper() and "WOMEN" not in title.upper() else (
            "Pound-for-Pound (Women's)" if is_p4p else split_division(title)[0] or title.title()
        )

        if not is_p4p:
            name_tag = box.select_one("h4.mb-2")
            vacant = box.select_one(".top-img-box.is-vacant") is not None
            champion = clean(name_tag.get_text(" ")) if name_tag else ""
            if champion:
                rows.append(
                    {
                        "category": category, "is_p4p": False, "rank": 0, "fighter": "" if vacant else champion,
                        "rank_change": "", "status": "vacant" if vacant else "champion", "athlete_url": "",
                    }
                )
        for line in box.select(".ranking-line"):
            label = clean((line.select_one(".black-box") or line).get_text())
            name = clean((line.select_one("h6") or line).get_text())
            if not name:
                continue
            movement = line.select_one(".movement-col")
            move_text = clean(movement.get_text()) if movement else ""
            arrow = movement.select_one(".movement-arrow") if movement else None
            change = ""
            if arrow is not None and move_text.isdigit():
                change = ("up" if "positive" in arrow.get("class", []) else "down") + f" {move_text}"
            elif move_text.upper() == "NR":
                change = "new"
            if label.isdigit():
                rows.append(
                    {
                        "category": category, "is_p4p": is_p4p, "rank": int(label), "fighter": name,
                        "rank_change": change, "status": "", "athlete_url": "",
                    }
                )
            elif label.upper() in {"IC", "C"} and not is_p4p:
                rows.append(
                    {
                        "category": category, "is_p4p": False, "rank": 0, "fighter": name,
                        "rank_change": "", "status": "interim" if label.upper() == "IC" else "champion", "athlete_url": "",
                    }
                )
    return rows


def rankings_problem(rows: list[dict], previous_rows: int = 0) -> str | None:
    """Why a scraped rankings table should not replace the stored one (None = it is fine)."""
    if not rows:
        return "the rankings page returned zero rows"
    categories = {row["category"] for row in rows}
    if len(categories) < 5:
        return f"only {len(categories)} categories found"
    if previous_rows and len(rows) < previous_rows * 0.6:
        return f"rows dropped from {previous_rows} to {len(rows)}"
    return None


# --------------------------------------------------------------------------- assembling


def to_iso(value: date | str) -> str:
    return value.isoformat() if isinstance(value, date) else str(value)


def fight_rows_from_event(event: dict) -> list[dict]:
    rows = []
    for order, fight in enumerate(event["fights"]):
        stage = fight["stage"]
        rows.append(
            {
                "event_name": event["name"],
                "event_date": to_iso(event["date"]),
                "location": event["location"],
                "event_url": event["url"],
                "event_slug": event["slug"],
                "circuit": event["circuit"],
                "fight_url": fight["fight_url"],
                "card_order": order,
                "fighter_1": fight["fighter_1"],
                "fighter_2": fight["fighter_2"],
                "fighter_1_url": fight["fighter_1_url"],
                "fighter_2_url": fight["fighter_2_url"],
                "winner": fight["winner"],
                "outcome": fight["outcome"],
                "weight_class": fight["weight_class"],
                "stage": stage,
                "title_fight": "true" if is_title_stage(stage) else "",
                "method": fight["method"],
                "method_detail": fight["method_detail"],
                "round": "" if fight["round"] is None else fight["round"],
                "time": fight["time"],
            }
        )
    return rows


def merge_fighter_details(fights: list[dict], details: dict[str, list[dict]]) -> int:
    """Fill weight class, stage, round and time from the fighter pages. Returns how many bouts were enriched."""
    enriched = 0
    for fight in fights:
        candidates = details.get(fight["event_slug"], [])
        match = next(
            (
                row for row in candidates
                if row["_owner"] in (name_key(fight["fighter_1"]), name_key(fight["fighter_2"]))
                and _surname_matches(row["opponent_surname"], fight["fighter_2"] if row["_owner"] == name_key(fight["fighter_1"]) else fight["fighter_1"])
            ),
            None,
        )
        if match is None:
            continue
        enriched += 1
        for key in ("weight_class", "stage"):
            if match[key] and not fight[key]:
                fight[key] = match[key]
        if match["method"] and (not fight["method"] or fight["method"] == "DEC" and match["method"] != "DEC"):
            fight["method"] = match["method"]
        if match["method_detail"] and not fight["method_detail"]:
            fight["method_detail"] = match["method_detail"]
        if match["round"] and not fight["round"]:
            fight["round"] = match["round"]
        if match["time"] and not fight["time"]:
            fight["time"] = match["time"]
        fight["title_fight"] = "true" if is_title_stage(fight["stage"]) else ""
    return enriched


def fill_missing_weight_classes(fights: list[dict], fighters: dict[str, dict]) -> int:
    """Some early regular-season bouts are on no fighter page. When both fighters' profiles name the same division, that
    is the bout's division. Returns how many bouts it filled."""
    by_name = {name_key(profile["name"]): profile["weight_class"] for profile in fighters.values() if profile.get("weight_class")}
    filled = 0
    for fight in fights:
        if fight["weight_class"]:
            continue
        first, second = by_name.get(name_key(fight["fighter_1"])), by_name.get(name_key(fight["fighter_2"]))
        if first and first == second:
            fight["weight_class"] = first
            filled += 1
    return filled


def _surname_matches(surname: str, full_name: str) -> bool:
    surname_key, full_key = name_key(surname), name_key(full_name)
    return bool(surname_key) and set(surname_key.split()) <= set(full_key.split())


def is_settled(fights: list[dict]) -> bool:
    return bool(fights) and all(fight["outcome"] for fight in fights)


# --------------------------------------------------------------------------- photos


def attach_local_photos(fighters: list[dict]) -> None:
    """Point every fighter at the photo in frontend/public/fighter-photos/pfl when there is one (the CSV is rebuilt from the
    profile pages on every run, so the link is made again each time)."""
    for fighter in fighters:
        fighter["image_url"] = f"{PHOTOS_WEB_PREFIX}{fighter['slug']}.webp" if (PHOTOS_DIR / f"{fighter['slug']}.webp").exists() else ""


def download_photos(fighters: list[dict], fetcher: Fetcher, limit: int) -> int:
    """Re-encode headshots as small WebP files. Only fighters with a real (non placeholder) photo and no local copy."""
    from scripts.download_fighter_photos import to_webp

    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    done = 0
    for fighter in fighters:
        target = PHOTOS_DIR / f"{fighter['slug']}.webp"
        if fighter["headshot_url"] and not target.exists() and done < limit:
            try:
                time.sleep(fetcher.delay)
                response = fetcher.session.get(fighter["headshot_url"], timeout=TIMEOUT_SECONDS)
                response.raise_for_status()
                target.write_bytes(to_webp(response.content, max_width=PHOTO_MAX_WIDTH, method=PHOTO_WEBP_METHOD))
                done += 1
            except Exception as error:  # noqa: BLE001 - a missing photo must not stop the refresh
                print(f"[warn] photo for {fighter['name']}: {error}")
    return done


# --------------------------------------------------------------------------- main


def load_rows(path: Path) -> list[dict]:
    return load_csv(path)[1] if path.exists() else []


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="parse and report, write nothing")
    parser.add_argument("--full", action="store_true", help="re-read every event and fighter page")
    parser.add_argument("--photos", action="store_true", help="download headshots as WebP into frontend/public/fighter-photos/pfl")
    parser.add_argument("--limit", type=int, default=400, help="max photos to download in one run (default 400)")
    parser.add_argument("--max-fighters", type=int, help="stop reading fighter pages after this many (testing)")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY_SECONDS)
    parser.add_argument("--cache-dir", type=Path, help="keep downloaded pages here so an interrupted run can resume")
    args = parser.parse_args(argv)

    fetcher = Fetcher(delay=args.delay, cache_dir=args.cache_dir)
    today = date.today()
    window_start = today - timedelta(days=REFRESH_DAYS)

    old_fights = load_rows(FIGHTS_PATH)
    old_fighters = {row["slug"]: row for row in load_rows(FIGHTERS_PATH)}
    old_by_event: dict[str, list[dict]] = {}
    for row in old_fights:
        old_by_event.setdefault(row["event_slug"], []).append(row)

    # 1. events: the listing (upcoming first) and the sitemap (all of them)
    slugs = parse_event_links(fetcher.get(EVENTS_URL))
    slugs += [slug for slug in parse_event_links(fetcher.get(SITEMAP_URL)) if slug not in slugs]
    print(f"[info] {len(slugs)} event pages listed")

    events: list[dict] = []
    reused: list[dict] = []
    for slug in slugs:
        previous = old_by_event.get(slug, [])
        if previous and not args.full:
            event_date = date.fromisoformat(previous[0]["event_date"])
            if event_date < window_start and is_settled(previous):
                reused.extend(previous)
                continue
        event = parse_event_page(fetcher.get(f"{BASE_URL}/event/{slug}"), f"{BASE_URL}/event/{slug}")
        if event is None:
            print(f"[warn] {slug}: no event data on the page, skipped")
            continue
        events.append(event)
    print(f"[info] {len(events)} events read, {len({row['event_slug'] for row in reused})} reused from {FIGHTS_PATH.name}")

    fights = [row for event in events for row in fight_rows_from_event(event)]

    # 2. fighters: the ones on the events read now, new ones, and the ranked ones
    rankings_html = fetcher.get(RANKINGS_URL)
    rankings = parse_rankings(rankings_html)
    problem = rankings_problem(rankings, previous_rows=len(load_rows(RANKINGS_PATH)))
    if problem:
        print(f"[warn] rankings not updated: {problem}")
        rankings = []

    wanted: dict[str, str] = {}  # profile url -> name
    fresh = {id(fight) for fight in fights}
    for fight in fights + reused:
        for side in ("fighter_1", "fighter_2"):
            url = fight[f"{side}_url"]
            if url and (id(fight) in fresh or slug_of(url) not in old_fighters):
                wanted.setdefault(url, fight[side])
    if args.full:
        for fight in reused:
            for side in ("fighter_1", "fighter_2"):
                if fight[f"{side}_url"]:
                    wanted.setdefault(fight[f"{side}_url"], fight[side])
    ranked = {name_key(row["fighter"]) for row in rankings if row["fighter"]}
    by_name_url = {name_key(name): url for url, name in wanted.items()}
    known_urls = {row["profile_url"]: row for row in old_fighters.values()}
    for key in ranked:
        url = by_name_url.get(key) or next((u for u, row in known_urls.items() if name_key(row["name"]) == key), None)
        if url:
            wanted.setdefault(url, key)

    profiles: dict[str, dict] = {}
    fight_counts: dict[str, int] = {}
    details: dict[str, list[dict]] = {}
    failures: list[str] = []
    for count, url in enumerate(wanted, 1):
        if args.max_fighters and count > args.max_fighters:
            break
        try:
            parsed = parse_fighter_page(fetcher.get(url), url)
        except RuntimeError as error:
            failures.append(str(error))
            continue
        if parsed is None:
            failures.append(f"{url}: not a fighter profile")
            continue
        profile = parsed["profile"]
        profile["checked"] = today.isoformat()
        # A fighter can have a page in two sections of the site (regular season and world tournament...): keep the fuller one.
        if profile["slug"] in profiles and len(parsed["fights"]) < fight_counts[profile["slug"]]:
            continue
        profiles[profile["slug"]] = profile
        fight_counts[profile["slug"]] = len(parsed["fights"])
        owner = name_key(profile["name"])
        for row in parsed["fights"]:
            details.setdefault(row["event_slug"], []).append({**row, "_owner": owner})
        if count % 100 == 0:
            print(f"[info] {count}/{len(wanted)} fighter pages")

    enriched = merge_fighter_details(fights, details)
    print(f"[info] {len(profiles)} fighter pages read, {enriched}/{len(fights)} bouts enriched, {len(failures)} failures")
    for failure in failures[:10]:
        print(f"[warn] {failure}")

    # 3. combine with what was stored before
    all_fights = fights + reused
    # Newest event first; inside an event the order of the card (main event first) is kept.
    all_fights.sort(key=lambda row: int(row["card_order"] or 0))
    all_fights.sort(key=lambda row: (row["event_date"], row["event_slug"]), reverse=True)
    fighters = {**old_fighters, **profiles}
    print(f"[info] weight class filled from the profiles for {fill_missing_weight_classes(all_fights, fighters)} bouts")
    _fill_fight_dates(fighters.values(), all_fights, today.isoformat())
    ordered_fighters = sorted(fighters.values(), key=lambda row: ascii_name(row["name"]).lower())

    if args.photos and not args.dry_run:
        print(f"[info] photos downloaded: {download_photos(ordered_fighters, fetcher, args.limit)}")
    attach_local_photos(ordered_fighters)

    upcoming = sorted({row["event_slug"] for row in all_fights if row["event_date"] >= today.isoformat()})
    print(f"[info] {len(all_fights)} bouts in {len({r['event_slug'] for r in all_fights})} events, {len(ordered_fighters)} fighters, "
          f"{len(upcoming)} upcoming events, {len(rankings)} ranking rows")
    if not all_fights or not ordered_fighters:
        print("[error] nothing parsed; files left untouched")
        return 1
    if args.dry_run:
        print("[dry-run] nothing written")
        return 0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    save_csv(FIGHTS_PATH, FIGHT_FIELDS, all_fights)
    save_csv(FIGHTERS_PATH, FIGHTER_FIELDS, ordered_fighters)
    if rankings:
        save_csv(RANKINGS_PATH, RANKING_FIELDS, rankings)
    return 0


def _fill_fight_dates(fighters, fights: list[dict], today: str) -> None:
    """First and last bout date of every fighter, read from the stored fights. Bouts still to come do not count."""
    dates: dict[str, list[str]] = {}
    for row in fights:
        if row["event_date"] >= today:
            continue
        for side in ("fighter_1", "fighter_2"):
            dates.setdefault(name_key(row[side]), []).append(row["event_date"])
    for fighter in fighters:
        own = sorted(dates.get(name_key(fighter["name"]), []))
        fighter["first_fight_date"] = own[0] if own else ""
        fighter["last_fight_date"] = own[-1] if own else ""


if __name__ == "__main__":
    sys.exit(main())
