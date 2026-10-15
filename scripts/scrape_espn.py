"""Update events, results, upcoming cards and fighter data from ESPN's public JSON API.

ufcstats.com is still the base of the dataset (full history, per-fighter career
stats such as accuracy/defense) but it fronts every page with a bot challenge,
so day-to-day updates come from ESPN instead. The two sources work together:

- Events / fight results / upcoming cards: ESPN (new rows have blank
  event_url / fight_url, since those are ufcstats IDs; events_service groups by
  event name when the URL is empty). Existing ufcstats rows are kept and matched.
- Fighter records (W-L-D): refreshed from ESPN for fighters in the scanned window.
- Fighters missing from fighters.csv (debuts): added from ESPN's athlete profile
  (height, reach, stance, date of birth, record). fighter_url holds the ESPN
  profile link. Career stats (accuracy, defense, ...) stay ufcstats-only.

Usage (from the repo root):
    python -m scripts.scrape_espn --dry-run     # show what would change
    python -m scripts.scrape_espn               # apply
    python -m scripts.scrape_espn --since 2026-01-01 --no-prune

Idempotent: events/bouts already in the CSVs are matched by date + fighter names
and are not added twice.
"""

from __future__ import annotations

import argparse
import copy
import csv
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher, get_close_matches
from pathlib import Path
from typing import Callable

import requests

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ufc_predictor.config import RAW_DATA_DIR

SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard"
CORE_URL = "https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc"
ATHLETE_URL = "https://sports.core.api.espn.com/v2/sports/mma/athletes/{athlete_id}?lang=en"
ATHLETE_PAGE_URL = "https://www.espn.com.br/mma/fighter/_/id/{athlete_id}/{slug}"

HEADERS = {"User-Agent": "ufcpredictor/1.0 (personal project; reads public ESPN JSON)"}
REQUEST_DELAY_SECONDS = 0.3
TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
HOMONYM_RECORD_GAP = 6

EVENT_CARDS_PATH = RAW_DATA_DIR / "event_cards.csv"
FIGHTS_PATH = RAW_DATA_DIR / "fights.csv"
EVENTS_PATH = RAW_DATA_DIR / "events.csv"
UPCOMING_PATH = RAW_DATA_DIR / "upcoming_events.csv"
FIGHTERS_PATH = RAW_DATA_DIR / "fighters.csv"
CAREER_STATS_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"

EVENT_CARD_FIELDS = [
    "event_name", "event_date", "location", "event_url", "fight_url", "fighter_1", "fighter_2",
    "winner", "weight_class", "method", "method_detail", "round", "time",
]
FIGHT_FIELDS = ["event_name", "event_date", "fight_url", "fighter_1", "fighter_2", "weight_class", "method", "round", "time"]
EVENT_FIELDS = ["event_name", "event_date", "event_url"]
FIGHTER_FIELDS = [
    "first_name", "last_name", "nickname", "height", "weight", "reach", "stance", "wins", "losses", "draws",
    "belt", "fighter_url",
]
CAREER_FIELDS = [
    "fighter_url", "dob", "sig_str_acc", "takedown_acc", "slpm", "sapm", "str_def", "td_avg", "td_def",
    "sub_avg", "wins", "losses", "draws",
]

US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado",
    "CT": "Connecticut", "DE": "Delaware", "DC": "DC", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky",
    "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan",
    "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
    "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon",
    "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}
CA_PROVINCES = {
    "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick", "NL": "Newfoundland",
    "NS": "Nova Scotia", "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec", "SK": "Saskatchewan",
}
# ESPN reports UTC; for events held in the Americas a start before 09:00 UTC belongs to the previous local day.
AMERICAS = {"USA", "Canada", "Brazil", "Mexico"}

NON_DECOMPOSING = {"ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ø": "o", "Ø": "O", "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe"}


# --------------------------------------------------------------------------- names / labels


def ascii_name(value: str) -> str:
    value = "".join(NON_DECOMPOSING.get(char, char) for char in value or "")
    value = unicodedata.normalize("NFD", value)
    return " ".join("".join(c for c in value if unicodedata.category(c) != "Mn").split())


def name_key(value: str) -> str:
    """Accent/case/order-insensitive key ('Zhang Tiequan' == 'Tiequan Zhang')."""
    tokens = re.sub(r"[^a-z0-9]+", " ", ascii_name(value).lower()).split()
    return " ".join(sorted(tokens))


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, name_key(a), name_key(b)).ratio()


def same_pair(a1: str, a2: str, b1: str, b2: str) -> bool:
    """Same bout despite spelling variants ('Timmy' / 'Timothy' Cuamba, 'SuYoung You' / 'You Su-young')."""
    for x, y in ((b1, b2), (b2, b1)):
        r1, r2 = _ratio(a1, x), _ratio(a2, y)
        if (r1 >= 0.75 and r2 >= 0.75) or (r1 >= 0.9 and r2 >= 0.55) or (r2 >= 0.9 and r1 >= 0.55):
            return True
    return False


def map_weight_class(label: str) -> str:
    label = (label or "").strip()
    if not label:
        return ""
    if label.lower() in {"catchweight", "catch weight", "w catch weight", "w catchweight"}:
        return "Catch Weight"
    if label.startswith("W "):
        return "Women's " + label[2:]
    return label


def map_result(result: dict | None) -> tuple[str, str]:
    """ESPN status.result -> (method, method_detail) in the dataset's vocabulary."""
    if not result:
        return "", ""
    name = (result.get("name") or "").lower()
    display = result.get("displayName") or ""
    detail = result.get("displayDescription") or ""
    if "draw" in name or name.startswith("decision"):
        kind = "majority" if "majority" in name else "split" if "split" in name else "unanimous"
        return {"majority": "M-DEC", "split": "S-DEC", "unanimous": "U-DEC"}[kind], ""
    if name == "kotko":
        return "KO/TKO", detail
    if name.startswith("tko") or name.startswith("ko"):
        return "KO/TKO", display.split(" - ", 1)[1] if " - " in display else detail
    if name.startswith("submission"):
        return "SUB", detail
    if "disqualification" in name or name == "dq":
        return "DQ", ""
    if "no-contest" in name or "no contest" in name:
        return "Overturned", ""
    return "Other", ""


def format_location(venue: dict | None) -> str:
    address = (venue or {}).get("address") or {}
    city, state, country = address.get("city", ""), address.get("state", ""), address.get("country", "")
    if country == "USA":
        state = US_STATES.get(state, state)
    elif country == "Canada":
        state = CA_PROVINCES.get(state, state)
    else:
        state = ""
    return ", ".join(part for part in (city, state, country) if part)


# --------------------------------------------------------------------------- ESPN payloads


@dataclass
class EspnFighter:
    espn_id: str
    name: str
    record: tuple[int, int, int] | None = None


@dataclass
class EspnBout:
    competition_id: str
    weight_class: str
    fighters: list[EspnFighter]
    winner_index: int | None
    completed: bool
    period: int | None = None
    clock: str = ""


@dataclass
class EspnEvent:
    espn_id: str
    name: str
    day: date
    venue: dict | None
    bouts: list[EspnBout] = field(default_factory=list)

    @property
    def completed(self) -> bool:
        return bool(self.bouts) and all(b.completed for b in self.bouts)


def is_tracked_event(name: str) -> bool:
    return "Contender Series" not in name and not re.search(r"Ultimate Fighter.*Semifinal", name, re.I)


def parse_record(competitor: dict) -> tuple[int, int, int] | None:
    for record in competitor.get("records") or []:
        match = re.match(r"^(\d+)-(\d+)-(\d+)", record.get("summary") or "")
        if match:
            return int(match.group(1)), int(match.group(2)), int(match.group(3))
    return None


def event_day(raw_date: str, venue: dict | None) -> date:
    moment = datetime.strptime(raw_date[:16], "%Y-%m-%dT%H:%M")
    country = ((venue or {}).get("address") or {}).get("country", "")
    if country in AMERICAS and moment.hour < 9:
        moment -= timedelta(days=1)
    return moment.date()


def parse_scoreboard(payload: dict) -> list[EspnEvent]:
    events: list[EspnEvent] = []
    for raw in payload.get("events", []):
        if not is_tracked_event(raw.get("name", "")):
            continue
        venue = (raw.get("venues") or [None])[0]
        event = EspnEvent(
            espn_id=str(raw["id"]), name=ascii_name(raw["name"]), day=event_day(raw["date"], venue), venue=venue
        )
        for comp in raw.get("competitions", []):
            competitors = sorted(comp.get("competitors", []), key=lambda c: c.get("order", 0))
            if len(competitors) != 2 or not all("athlete" in c for c in competitors):
                continue
            names = [c["athlete"]["displayName"] for c in competitors]
            if any(n.strip().upper() == "TBA" or "TBA" in n.split() for n in names):
                continue
            status = comp.get("status") or {}
            winners = [i for i, c in enumerate(competitors) if c.get("winner")]
            event.bouts.append(
                EspnBout(
                    competition_id=str(comp["id"]),
                    weight_class=map_weight_class((comp.get("type") or {}).get("abbreviation", "")),
                    fighters=[
                        EspnFighter(str(c["id"]), ascii_name(c["athlete"]["displayName"]), parse_record(c))
                        for c in competitors
                    ],
                    winner_index=winners[0] if winners else None,
                    completed=bool((status.get("type") or {}).get("completed")),
                    period=status.get("period"),
                    clock=status.get("displayClock") or "",
                )
            )
        if event.bouts:
            events.append(event)
    return events


# --------------------------------------------------------------------------- CSV tables


def load_csv(path: Path) -> tuple[list[str], list[dict]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def save_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\r\n", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


@dataclass
class Tables:
    cards: list[dict]
    fights: list[dict]
    events: list[dict]
    upcoming: list[dict]
    fighters: list[dict]
    career: list[dict]


def parse_day(text: str) -> date | None:
    try:
        return datetime.strptime(text, "%B %d, %Y").date()
    except (TypeError, ValueError):
        return None


def format_day(day: date) -> str:
    return day.strftime("%B %d, %Y")


def group_events(rows: list[dict]) -> dict[tuple[str, str], list[dict]]:
    groups: dict[tuple[str, str], list[dict]] = {}
    for row in rows:
        groups.setdefault((row["event_name"], row["event_date"]), []).append(row)
    return groups


def find_event_key(event: EspnEvent, groups: dict[tuple[str, str], list[dict]]) -> tuple[str, str] | None:
    best, best_score = None, 0.0
    for key in groups:
        day = parse_day(key[1])
        if day is None or abs((day - event.day).days) > 1:
            continue
        score = SequenceMatcher(None, ascii_name(key[0]).lower(), event.name.lower()).ratio()
        if score > best_score:
            best, best_score = key, score
    return best if best_score >= 0.5 else None


# --------------------------------------------------------------------------- fighter catalog


class Catalog:
    """Matches ESPN athletes to fighters.csv rows (exact name key, then guarded fuzzy match)."""

    def __init__(self, fighters: list[dict], career: list[dict] | None = None):
        self.rows = fighters
        self.career = {r["fighter_url"]: r for r in (career or [])}
        self.index: dict[str, list[dict]] = {}
        for row in fighters:
            self.index.setdefault(name_key(self.name_of(row)), []).append(row)
        self.created: dict[str, dict] = {}

    @staticmethod
    def name_of(row: dict) -> str:
        return f"{row.get('first_name', '')} {row.get('last_name', '')}".strip()

    def _record(self, row: dict) -> tuple[int, int]:
        """Effective W-L: career-stat counts win over fighters.csv, like the backend catalog does."""

        def num(value):
            try:
                return int(float(value))
            except (TypeError, ValueError):
                return 0

        career = self.career.get(row.get("fighter_url", ""))
        source = career if career is not None and career.get("wins", "") != "" else row
        return num(source.get("wins")), num(source.get("losses"))

    def _gap(self, row: dict, record: tuple[int, int, int]) -> int:
        wins, losses = self._record(row)
        return abs(wins - record[0]) + abs(losses - record[1])

    def find(self, fighter: EspnFighter) -> tuple[dict | None, str]:
        key = name_key(fighter.name)
        if fighter.espn_id in self.created:
            return self.created[fighter.espn_id], "created"
        matches = self.index.get(key, [])
        if len(matches) == 1:
            # Same name but a very different record: most likely a homonym, not the same fighter.
            if fighter.record and self._gap(matches[0], fighter.record) > HOMONYM_RECORD_GAP:
                return None, "ambiguous"
            return matches[0], "exact"
        if len(matches) > 1:
            if fighter.record:
                best = min(matches, key=lambda r: abs(self._record(r)[0] - fighter.record[0]) + abs(self._record(r)[1] - fighter.record[1]))
                gap = abs(self._record(best)[0] - fighter.record[0]) + abs(self._record(best)[1] - fighter.record[1])
                if gap <= 3:
                    return best, "exact"
            return None, "ambiguous"
        close = get_close_matches(key, list(self.index), n=3, cutoff=0.85 if fighter.record else 0.92)
        candidates = []
        for candidate in close:
            rows = self.index[candidate]
            if len(rows) != 1:
                continue
            if fighter.record is not None:
                wins, losses = self._record(rows[0])
                if abs(wins - fighter.record[0]) + abs(losses - fighter.record[1]) > 3:
                    continue
            candidates.append(rows[0])
        if len(candidates) == 1:
            return candidates[0], "fuzzy"
        if not candidates and fighter.record is not None:
            # 'Jose Miguel Delgado' vs 'Jose Delgado': one name's tokens contain the other's.
            tokens = set(key.split())
            subset = []
            for candidate, rows in self.index.items():
                other = set(candidate.split())
                small = min(len(tokens), len(other))
                if len(rows) == 1 and small >= 2 and (tokens <= other or other <= tokens):
                    wins, losses = self._record(rows[0])
                    if abs(wins - fighter.record[0]) + abs(losses - fighter.record[1]) <= 3:
                        subset.append(rows[0])
            if len(subset) == 1:
                return subset[0], "fuzzy"
        return None, "new"

    def canonical(self, fighter: EspnFighter) -> str:
        row, status = self.find(fighter)
        return self.name_of(row) if row is not None and status != "ambiguous" else fighter.name


def espn_id_from_url(url: str) -> str | None:
    match = re.search(r"espn\.[a-z.]+/mma/fighter/_/id/(\d+)", url or "")
    return match.group(1) if match else None


# --------------------------------------------------------------------------- sync logic


@dataclass
class Report:
    events_added: list[str] = field(default_factory=list)
    bouts_added: int = 0
    upcoming_events_added: list[str] = field(default_factory=list)
    upcoming_bouts_added: int = 0
    upcoming_bouts_dropped: list[str] = field(default_factory=list)
    upcoming_events_pruned: list[str] = field(default_factory=list)
    records_updated: int = 0
    record_changes: list[str] = field(default_factory=list)
    record_skipped: list[str] = field(default_factory=list)
    fighters_created: list[str] = field(default_factory=list)
    fuzzy_matches: list[str] = field(default_factory=list)
    ambiguous: list[str] = field(default_factory=list)


def _card_row(meta: dict, bout: EspnBout, catalog: Catalog, result: tuple[str, str] | None) -> dict:
    names = [catalog.canonical(f) for f in bout.fighters]
    order = [0, 1] if bout.winner_index in (None, 0) else [1, 0]
    method, detail = result or ("", "")
    row = {key: "" for key in EVENT_CARD_FIELDS}
    row.update(
        {
            "event_name": meta["event_name"], "event_date": meta["event_date"], "location": meta.get("location", ""),
            "event_url": meta.get("event_url", ""), "fighter_1": names[order[0]], "fighter_2": names[order[1]],
            "winner": names[bout.winner_index] if bout.winner_index is not None else "",
            "weight_class": bout.weight_class, "method": method, "method_detail": detail,
        }
    )
    if bout.completed:
        row["round"] = f"{float(bout.period)}" if bout.period else ""
        row["time"] = bout.clock
    return row


def _event_meta(event: EspnEvent, existing: list[dict] | None) -> dict:
    if existing:
        return {k: existing[0].get(k, "") for k in ("event_name", "event_date", "location", "event_url")}
    return {
        "event_name": event.name, "event_date": format_day(event.day),
        "location": format_location(event.venue), "event_url": "",
    }


def sync_completed_event(
    event: EspnEvent,
    tables: Tables,
    catalog: Catalog,
    fetch_result: Callable[[str, str], tuple[str, str]],
    report: Report,
) -> None:
    groups = group_events(tables.cards)
    key = find_event_key(event, groups)
    existing = groups.get(key, []) if key else []
    existing_bouts = [r for r in existing if r["fighter_1"]]
    meta = _event_meta(event, existing_bouts or None)
    added = 0
    for bout in event.bouts:
        if not bout.completed:
            continue
        names = [f.name for f in bout.fighters]
        if any(same_pair(r["fighter_1"], r["fighter_2"], names[0], names[1]) for r in existing_bouts):
            continue
        result = fetch_result(event.espn_id, bout.competition_id)
        row = _card_row(meta, bout, catalog, result)
        tables.cards.append(row)
        tables.fights.append({k: row.get(k, "") for k in FIGHT_FIELDS})
        existing_bouts.append(row)
        added += 1
    report.bouts_added += added
    if key is None and added:
        report.events_added.append(f"{meta['event_name']} ({meta['event_date']}, {added} lutas)")
        if not any(e["event_name"] == meta["event_name"] and e["event_date"] == meta["event_date"] for e in tables.events):
            tables.events.append({"event_name": meta["event_name"], "event_date": meta["event_date"], "event_url": ""})
    elif added:
        report.events_added.append(f"{meta['event_name']} (+{added} lutas)")
    # A completed event no longer belongs in the upcoming list.
    upcoming_key = find_event_key(event, group_events(tables.upcoming))
    if upcoming_key:
        tables.upcoming[:] = [
            r for r in tables.upcoming if (r["event_name"], r["event_date"]) != upcoming_key
        ]


def sync_upcoming_event(event: EspnEvent, tables: Tables, catalog: Catalog, report: Report) -> None:
    groups = group_events(tables.upcoming)
    key = find_event_key(event, groups)
    existing = groups.get(key, []) if key else []
    meta = _event_meta(event, [r for r in existing if r["fighter_1"]] or None)
    espn_names = [f.name for b in event.bouts for f in b.fighters]
    rebuilt: list[dict] = []
    used: set[int] = set()
    for bout in event.bouts:
        names = [f.name for f in bout.fighters]
        hit = next(
            (i for i, r in enumerate(existing) if i not in used and r["fighter_1"] and same_pair(r["fighter_1"], r["fighter_2"], names[0], names[1])),
            None,
        )
        if hit is not None:
            used.add(hit)
            row = existing[hit]
            if bout.weight_class:
                row["weight_class"] = bout.weight_class
            rebuilt.append(row)
        else:
            rebuilt.append(_card_row(meta, bout, catalog, None))
            report.upcoming_bouts_added += 1
    for i, row in enumerate(existing):
        if i in used or not row["fighter_1"]:
            continue
        conflict = any(_ratio(row[k], n) >= 0.9 for k in ("fighter_1", "fighter_2") for n in espn_names)
        if conflict:
            report.upcoming_bouts_dropped.append(f"{meta['event_name']}: {row['fighter_1']} vs {row['fighter_2']}")
        else:
            rebuilt.append(row)  # not contradicted by ESPN (its card may still be incomplete)
    if key is None:
        report.upcoming_events_added.append(f"{meta['event_name']} ({meta['event_date']}, {len(rebuilt)} lutas)")
        tables.upcoming.extend(rebuilt)
        return
    position = next(i for i, r in enumerate(tables.upcoming) if (r["event_name"], r["event_date"]) == key)
    tables.upcoming[:] = [r for r in tables.upcoming if (r["event_name"], r["event_date"]) != key]
    tables.upcoming[position:position] = rebuilt


def prune_upcoming(events: list[EspnEvent], tables: Tables, since: date, until: date, report: Report) -> None:
    for key in list(group_events(tables.upcoming)):
        day = parse_day(key[1])
        if day is None or not (since <= day <= until):
            continue
        if not any(abs((day - e.day).days) <= 1 and SequenceMatcher(None, ascii_name(key[0]).lower(), e.name.lower()).ratio() >= 0.5 for e in events):
            tables.upcoming[:] = [r for r in tables.upcoming if (r["event_name"], r["event_date"]) != key]
            report.upcoming_events_pruned.append(f"{key[0]} ({key[1]})")


def create_fighter(
    fighter: EspnFighter, tables: Tables, catalog: Catalog, fetch_athlete: Callable[[str], dict], report: Report
) -> None:
    athlete = fetch_athlete(fighter.espn_id)
    first = ascii_name(athlete.get("firstName") or fighter.name.split(" ")[0])
    last = ascii_name(athlete.get("lastName") or " ".join(fighter.name.split(" ")[1:]))
    wins, losses, draws = fighter.record or (0, 0, 0)
    reach = athlete.get("reach")
    dob = athlete.get("dateOfBirth") or ""
    slug = athlete.get("slug") or re.sub(r"[^a-z0-9]+", "-", fighter.name.lower()).strip("-")
    url = ATHLETE_PAGE_URL.format(athlete_id=fighter.espn_id, slug=slug)
    row = {
        "first_name": first, "last_name": last, "nickname": "",
        "height": athlete.get("displayHeight") or "--",
        "weight": (athlete.get("displayWeight") or "--").rstrip(".") + ("." if athlete.get("displayWeight") else ""),
        "reach": f'{float(reach):.1f}"' if reach else "--",
        "stance": (athlete.get("stance") or {}).get("text", ""),
        "wins": wins, "losses": losses, "draws": draws, "belt": "", "fighter_url": url,
    }
    tables.fighters.append(row)
    dob_text = "--"
    if dob:
        try:
            dob_text = datetime.strptime(dob[:10], "%Y-%m-%d").strftime("%b %d, %Y")
        except ValueError:
            pass
    tables.career.append(
        {
            "fighter_url": url, "dob": dob_text, "sig_str_acc": "--", "takedown_acc": "--", "slpm": "--",
            "sapm": "--", "str_def": "--", "td_avg": "--", "td_def": "--", "sub_avg": "--",
            "wins": wins, "losses": losses, "draws": draws,
        }
    )
    catalog.index.setdefault(name_key(f"{first} {last}"), []).append(row)
    catalog.created[fighter.espn_id] = row
    report.fighters_created.append(f"{first} {last}".strip())


def refresh_records(events: list[EspnEvent], tables: Tables, catalog: Catalog, report: Report) -> None:
    """Advance W-L-D records using ESPN's post-fight records.

    ESPN and ufcstats sometimes disagree on a fighter's baseline (different bout accounting, homonyms), so a
    record only moves when the stored value sits on ESPN's own timeline for that fighter (the record before the
    first scanned fight, or any post-fight record); otherwise it is left alone and reported for review.
    """
    history: dict[int, tuple[dict, list[tuple[tuple[int, int, int], tuple[int, int, int]]]]] = {}
    for event in sorted((e for e in events if e.completed), key=lambda e: e.day):
        for bout in event.bouts:
            for index, fighter in enumerate(bout.fighters):
                if fighter.record is None:
                    continue
                row, status = catalog.find(fighter)
                if row is None or status not in {"exact", "fuzzy", "created"}:
                    continue
                if bout.winner_index is None:
                    outcome = (0, 0, 1)
                else:
                    outcome = (1, 0, 0) if bout.winner_index == index else (0, 1, 0)
                history.setdefault(id(row), (row, []))[1].append((fighter.record, outcome))

    career_by_url = {r["fighter_url"]: r for r in tables.career}

    def as_ints(values) -> tuple[int, ...]:
        return tuple(int(float(v)) if v not in ("", None) else 0 for v in values)

    for row, steps in history.values():
        first_post, first_outcome = steps[0]
        timeline = {tuple(a - b for a, b in zip(first_post, first_outcome))} | {post for post, _ in steps}
        target = steps[-1][0]
        career = career_by_url.get(row.get("fighter_url", ""))
        # The catalog prefers career-stat counts over fighters.csv, so that is the "effective" record.
        source = career if career is not None and career.get("wins", "") != "" else row
        effective = as_ints([source.get(c, "") for c in ("wins", "losses", "draws")])
        label = f"{Catalog.name_of(row)}: {'-'.join(map(str, effective))} -> {'-'.join(map(str, target))}"
        if effective != target and effective not in timeline:
            report.record_skipped.append(label)
            continue
        for column, value in zip(("wins", "losses", "draws"), target):
            row[column] = str(value)
            if career is not None and career.get(column, "") != "":
                career[column] = str(value)
        if effective != target:
            report.records_updated += 1
            report.record_changes.append(label)


def sync(
    events: list[EspnEvent],
    tables: Tables,
    since: date,
    until: date,
    fetch_result: Callable[[str, str], tuple[str, str]],
    fetch_athlete: Callable[[str], dict],
    *,
    prune: bool = True,
    update_fighters: bool = True,
) -> Report:
    report = Report()
    catalog = Catalog(tables.fighters, tables.career)
    if update_fighters:
        seen: set[str] = set()
        for event in events:
            for bout in event.bouts:
                for fighter in bout.fighters:
                    if fighter.espn_id in seen:
                        continue
                    seen.add(fighter.espn_id)
                    row, status = catalog.find(fighter)
                    if status == "new":
                        create_fighter(fighter, tables, catalog, fetch_athlete, report)
                    elif status == "fuzzy":
                        report.fuzzy_matches.append(f"{fighter.name} -> {catalog.name_of(row)}")
                    elif status == "ambiguous":
                        report.ambiguous.append(f"{fighter.name} (ESPN {fighter.record})")
    for event in sorted(events, key=lambda e: e.day):
        if event.completed:
            sync_completed_event(event, tables, catalog, fetch_result, report)
        else:
            sync_upcoming_event(event, tables, catalog, report)
    if prune:
        prune_upcoming(events, tables, since, until, report)
    if update_fighters:
        refresh_records(events, tables, catalog, report)
    return report


# --------------------------------------------------------------------------- network


class EspnClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def get_json(self, url: str, params: dict | None = None) -> dict:
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.session.get(url, params=params, timeout=TIMEOUT_SECONDS)
                response.raise_for_status()
                return response.json()
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                if attempt < MAX_RETRIES:
                    time.sleep(REQUEST_DELAY_SECONDS * attempt * 2)
        raise RuntimeError(f"Failed to fetch {url}") from last_error

    def scoreboard(self, since: date, until: date) -> list[EspnEvent]:
        params = {"dates": f"{since:%Y%m%d}-{until:%Y%m%d}", "limit": 500}
        return parse_scoreboard(self.get_json(SCOREBOARD_URL, params))

    def fetch_result(self, event_id: str, competition_id: str) -> tuple[str, str]:
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            status = self.get_json(f"{CORE_URL}/events/{event_id}/competitions/{competition_id}/status?lang=en")
        except RuntimeError:
            return "", ""
        return map_result(status.get("result"))

    def fetch_athlete(self, athlete_id: str) -> dict:
        time.sleep(REQUEST_DELAY_SECONDS)
        try:
            return self.get_json(ATHLETE_URL.format(athlete_id=athlete_id))
        except RuntimeError:
            return {}


# --------------------------------------------------------------------------- main


def load_tables() -> tuple[Tables, dict[str, list[str]]]:
    headers: dict[str, list[str]] = {}
    data = {}
    for name, path, fallback in (
        ("cards", EVENT_CARDS_PATH, EVENT_CARD_FIELDS), ("fights", FIGHTS_PATH, FIGHT_FIELDS),
        ("events", EVENTS_PATH, EVENT_FIELDS), ("upcoming", UPCOMING_PATH, EVENT_CARD_FIELDS),
        ("fighters", FIGHTERS_PATH, FIGHTER_FIELDS), ("career", CAREER_STATS_PATH, CAREER_FIELDS),
    ):
        if path.exists():
            headers[name], data[name] = load_csv(path)
        else:
            headers[name], data[name] = fallback, []
    return Tables(**data), headers


def save_tables(tables: Tables, headers: dict[str, list[str]], before: Tables) -> None:
    for name, path in (
        ("cards", EVENT_CARDS_PATH), ("fights", FIGHTS_PATH), ("events", EVENTS_PATH),
        ("upcoming", UPCOMING_PATH), ("fighters", FIGHTERS_PATH), ("career", CAREER_STATS_PATH),
    ):
        if getattr(tables, name) != getattr(before, name):
            save_csv(path, headers[name], getattr(tables, name))
            print(f"[info] {path.name} atualizado")


def default_since(cards: list[dict]) -> date:
    days = [d for d in (parse_day(r["event_date"]) for r in cards) if d]
    return (max(days) if days else date.today()) - timedelta(days=30)


def print_report(report: Report, dry_run: bool) -> None:
    prefix = "[dry-run] " if dry_run else ""
    print(f"{prefix}Eventos com resultados adicionados: {len(report.events_added)} ({report.bouts_added} lutas)")
    for item in report.events_added:
        print(f"  + {item}")
    print(f"{prefix}Eventos futuros novos: {len(report.upcoming_events_added)} | lutas futuras novas: {report.upcoming_bouts_added}")
    for item in report.upcoming_events_added:
        print(f"  + {item}")
    for item in report.upcoming_bouts_dropped:
        print(f"  - luta removida (adversario trocado/cancelada): {item}")
    for item in report.upcoming_events_pruned:
        print(f"  - evento removido (ESPN nao lista): {item}")
    print(f"{prefix}Recordes atualizados: {report.records_updated} | lutadores novos: {len(report.fighters_created)}")
    for item in report.record_changes[:30]:
        print(f"  ~ recorde: {item}")
    for item in report.record_skipped:
        print(f"  ! recorde divergente, mantido (revisar): {item}")
    for item in report.fighters_created:
        print(f"  + lutador: {item}")
    for item in report.fuzzy_matches:
        print(f"  ~ nome associado por similaridade: {item}")
    for item in report.ambiguous:
        print(f"  ? nome ambiguo/homonimo, nao alterado (revisar): {item}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--since", type=date.fromisoformat, help="first day to scan (default: 30 days before the latest stored event)")
    parser.add_argument("--until", type=date.fromisoformat, help="last day to scan (default: today + 270 days)")
    parser.add_argument("--dry-run", action="store_true", help="show what would change without writing")
    parser.add_argument("--no-prune", action="store_true", help="keep upcoming events ESPN does not list")
    parser.add_argument("--no-fighters", action="store_true", help="skip fighter records and new-fighter creation")
    args = parser.parse_args(argv)

    tables, headers = load_tables()
    before = copy.deepcopy(tables)
    since = args.since or default_since(tables.cards)
    until = args.until or (date.today() + timedelta(days=270))
    client = EspnClient()
    print(f"[info] Fetching ESPN scoreboard {since} -> {until} ...")
    events = client.scoreboard(since, until)
    print(f"[info] {len(events)} eventos ({sum(e.completed for e in events)} realizados)")

    report = sync(
        events, tables, since, until, client.fetch_result, client.fetch_athlete,
        prune=not args.no_prune, update_fighters=not args.no_fighters,
    )
    print_report(report, args.dry_run)
    if args.dry_run:
        return
    save_tables(tables, headers, before)


if __name__ == "__main__":
    main()
