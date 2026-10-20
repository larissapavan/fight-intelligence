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
FIGHT_DETAILS_PATH = RAW_DATA_DIR / "fight_details.csv"
WEIGHT_OVERRIDES_PATH = RAW_DATA_DIR / "weight_overrides.csv"

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
FIGHT_DETAIL_FIELDS = ["fight_url", "referee", "num_rounds", "title_fight", "result", "result_details"]
RESULT_LABELS = {
    "U-DEC": "Decision - Unanimous",
    "S-DEC": "Decision - Split",
    "M-DEC": "Decision - Majority",
    "KO/TKO": "KO/TKO",
    "SUB": "Submission",
    "DQ": "DQ",
    "Overturned": "Overturned",
    "Other": "Other",
}
DECISION_METHODS = {"U-DEC", "S-DEC", "M-DEC"}
KNOWN_METHODS = set(RESULT_LABELS)
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")

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


def scheduled_rounds(competition: dict | None) -> str:
    periods = (((competition or {}).get("format") or {}).get("regulation") or {}).get("periods")
    try:
        periods = int(periods)
    except (TypeError, ValueError):
        return ""
    return str(periods) if 1 <= periods <= 5 else ""


def clean_round(period) -> str:
    try:
        period = int(period)
    except (TypeError, ValueError):
        return ""
    return f"{float(period)}" if 1 <= period <= 5 else ""


def clean_clock(value: str) -> str:
    value = (value or "").strip()
    return value if TIME_RE.match(value) else ""


def official_name(item: dict) -> str:
    """Drop ESPN placeholders such as 'Judge 1' so they never land in a scorecard."""
    first = ascii_name(str(item.get("firstName") or "")).strip()
    last = ascii_name(str(item.get("lastName") or "")).strip()
    if re.fullmatch(r"judge", first, re.I) and re.fullmatch(r"\d+", last):
        return ""
    name = f"{first} {last}".strip()
    if not name or name.lower() in {"referee", "judge"}:
        return ""
    return name


def parse_officials(payload: dict | None) -> tuple[str, list[tuple[str, str]]]:
    """Referee name, and judges as (official id, name) in ESPN's order."""
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
        return "", []
    referee = ""
    judges: list[tuple[int, str, str]] = []
    for item in payload["items"]:
        if not isinstance(item, dict):
            continue
        position = str((item.get("position") or {}).get("name") or "").lower()
        name = official_name(item)
        if position == "referee" and name and not referee:
            referee = name
        elif position == "judge" and name and item.get("id"):
            order = item.get("order")
            judges.append((order if isinstance(order, int) else 99, str(item["id"]), name))
    judges.sort(key=lambda judge: judge[0])
    return referee, [(official_id, name) for _, official_id, name in judges]


def parse_judge_scores(payload: dict | None) -> dict[str, int]:
    """One fighter's score from each judge. Values outside 1–50 are ignored."""
    if not isinstance(payload, dict) or not isinstance(payload.get("items"), list) or not payload["items"]:
        return {}
    first = payload["items"][0]
    lines = first.get("linescores") if isinstance(first, dict) else None
    if not isinstance(lines, list):
        return {}
    scores: dict[str, int] = {}
    for line in lines:
        if not isinstance(line, dict):
            continue
        official = line.get("official") if isinstance(line.get("official"), dict) else {}
        official_id = str(official.get("id") or "")
        if not official_id:
            match = re.search(r"/officials/(\d+)", str(official.get("$ref") or ""))
            official_id = match.group(1) if match else ""
        try:
            value = int(float(line.get("value")))
        except (TypeError, ValueError):
            continue
        if official_id and 1 <= value <= 50:
            scores[official_id] = value
    return scores


def format_scorecards(judges: list[tuple[str, str]], scores_a: dict[str, int], scores_b: dict[str, int]) -> str:
    """'Judge 28 - 29. ...' with fighter 1's score first, matching fight_details.csv."""
    parts: list[str] = []
    for official_id, name in judges:
        score_a = scores_a.get(official_id)
        score_b = scores_b.get(official_id)
        if score_a is None or score_b is None:
            continue
        parts.append(f"{name} {score_a} - {score_b}")
    return ". ".join(parts) + ("." if parts else "")


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
    scheduled_rounds: str = ""


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
                    scheduled_rounds=scheduled_rounds(comp),
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
class BoutDetail:
    method: str = ""
    method_detail: str = ""
    referee: str = ""
    num_rounds: str = ""
    result: str = ""
    judges: list[tuple[str, str]] = field(default_factory=list)
    scores: dict[str, dict[str, int]] = field(default_factory=dict)

    @property
    def usable_method(self) -> str:
        return self.method if self.method in KNOWN_METHODS else ""


def coerce_detail(result: BoutDetail | tuple | None) -> BoutDetail:
    if isinstance(result, BoutDetail):
        result.method = result.usable_method
        return result
    if isinstance(result, tuple) and len(result) == 2:
        method, detail = result
        method = method if method in KNOWN_METHODS else ""
        return BoutDetail(method=method, method_detail=str(detail or ""), result=RESULT_LABELS.get(method, ""))
    return BoutDetail()


@dataclass
class Tables:
    cards: list[dict]
    fights: list[dict]
    events: list[dict]
    upcoming: list[dict]
    fighters: list[dict]
    career: list[dict]
    details: list[dict] = field(default_factory=list)


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
    details_added: int = 0
    detail_skipped: list[str] = field(default_factory=list)


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
        row["round"] = clean_round(bout.period)
        row["time"] = clean_clock(bout.clock)
    return row


def athlete_id_for(name: str, bout: EspnBout, catalog: Catalog) -> str:
    for fighter in bout.fighters:
        canonical = catalog.canonical(fighter)
        if name_key(name) == name_key(canonical) or name_key(name) == name_key(fighter.name) or _ratio(name, canonical) >= 0.9:
            return fighter.espn_id
    return ""


def aligned_winner(bout: EspnBout, row: dict, catalog: Catalog) -> str:
    if bout.winner_index is None or not (0 <= bout.winner_index < len(bout.fighters)):
        return ""
    winner = catalog.canonical(bout.fighters[bout.winner_index])
    existing = [name for name in (row.get("fighter_1"), row.get("fighter_2")) if name]
    if not existing:
        return winner
    for name in existing:
        if name_key(name) == name_key(winner) or _ratio(name, winner) >= 0.9:
            return name
    return ""


def scorecard_text(detail: BoutDetail, bout: EspnBout, row: dict, catalog: Catalog) -> str:
    if detail.usable_method not in DECISION_METHODS:
        return detail.method_detail if detail.usable_method else ""
    scores_a = detail.scores.get(athlete_id_for(row.get("fighter_1", ""), bout, catalog), {})
    scores_b = detail.scores.get(athlete_id_for(row.get("fighter_2", ""), bout, catalog), {})
    return format_scorecards(detail.judges, scores_a, scores_b)


def espn_fight_url(bout: EspnBout) -> str:
    if not str(bout.competition_id).isdigit():
        return ""
    return f"https://www.espn.com/mma/fightcenter/_/id/{bout.competition_id}"


def detail_saved(tables: Tables, fight_url: str) -> bool:
    return bool(fight_url) and any(
        existing.get("fight_url") == fight_url and (existing.get("referee") or existing.get("result"))
        for existing in tables.details
    )


def upsert_fight_detail(tables: Tables, row: dict) -> None:
    fight_url = (row.get("fight_url") or "").strip()
    if not fight_url:
        return
    tables.details[:] = [existing for existing in tables.details if existing.get("fight_url") != fight_url]
    tables.details.append({key: row.get(key, "") for key in FIGHT_DETAIL_FIELDS})


def _remember_fight(tables: Tables, row: dict) -> None:
    fight = {key: row.get(key, "") for key in FIGHT_FIELDS}
    for existing in tables.fights:
        same_url = fight["fight_url"] and existing.get("fight_url") == fight["fight_url"]
        same_bout = (
            existing.get("event_name") == fight["event_name"]
            and existing.get("event_date") == fight["event_date"]
            and same_pair(existing.get("fighter_1", ""), existing.get("fighter_2", ""), fight["fighter_1"], fight["fighter_2"])
        )
        if same_url or same_bout:
            existing.update(fight)
            return
    tables.fights.append(fight)


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
    fetch_result: Callable[[EspnEvent, EspnBout], BoutDetail | tuple],
    report: Report,
) -> None:
    groups = group_events(tables.cards)
    key = find_event_key(event, groups)
    existing = groups.get(key, []) if key else []
    existing_bouts = [r for r in existing if r["fighter_1"]]
    upcoming_key = find_event_key(event, group_events(tables.upcoming))
    upcoming_rows = [
        row for row in tables.upcoming if upcoming_key and (row["event_name"], row["event_date"]) == upcoming_key and row.get("fighter_1")
    ]
    meta = _event_meta(event, existing_bouts or upcoming_rows or None)
    added = 0
    failed = 0
    moved: set[int] = set()
    for bout in event.bouts:
        if not bout.completed or len(bout.fighters) != 2:
            continue
        names = [fighter.name for fighter in bout.fighters]
        already = next((row for row in existing_bouts if same_pair(row["fighter_1"], row["fighter_2"], names[0], names[1])), None)
        if already and already.get("winner") and detail_saved(tables, already.get("fight_url", "")):
            continue
        try:
            detail = coerce_detail(fetch_result(event, bout))
        except Exception as exc:  # noqa: BLE001 - one bad bout must not abort the card
            failed += 1
            report.detail_skipped.append(f"{event.name}: {names[0]} vs {names[1]} ({exc})")
            continue
        detail.num_rounds = detail.num_rounds or bout.scheduled_rounds
        announced = next((row for row in upcoming_rows if same_pair(row["fighter_1"], row["fighter_2"], names[0], names[1])), None)
        if announced is not None:
            row = {column: announced.get(column, "") for column in EVENT_CARD_FIELDS}
            if not aligned_winner(bout, row, catalog) and bout.winner_index is not None:
                report.detail_skipped.append(f"{event.name}: winner for {names[0]} vs {names[1]} did not match the card")
            row["winner"] = aligned_winner(bout, row, catalog)
            row["method"] = detail.usable_method
            row["method_detail"] = detail.method_detail if detail.usable_method else ""
            row["round"] = clean_round(bout.period)
            row["time"] = clean_clock(bout.clock)
            if bout.weight_class:
                row["weight_class"] = bout.weight_class
        elif already is not None:
            row = already
            row["winner"] = aligned_winner(bout, row, catalog)
            row["method"] = detail.usable_method
            row["method_detail"] = detail.method_detail if detail.usable_method else ""
            row["round"] = clean_round(bout.period)
            row["time"] = clean_clock(bout.clock)
        else:
            row = _card_row(meta, bout, catalog, (detail.usable_method, detail.method_detail if detail.usable_method else ""))
            if bout.winner_index is not None and not row["winner"]:
                report.detail_skipped.append(f"{event.name}: {names[0]} vs {names[1]} had no usable winner")
        if not (row.get("fight_url") or "").strip():
            row["fight_url"] = espn_fight_url(bout)
        backfill = already is not None and bool(already.get("winner"))
        if not backfill and announced is None and already is None:
            tables.cards.append(row)
        elif not backfill and announced is not None:
            tables.cards.append(row)
            moved.add(id(announced))
        scorecards = scorecard_text(detail, bout, row, catalog)
        if row.get("fight_url"):
            upsert_fight_detail(
                tables,
                {
                    "fight_url": row["fight_url"],
                    "referee": detail.referee,
                    "num_rounds": detail.num_rounds,
                    "title_fight": "false",
                    "result": detail.result if detail.usable_method else "",
                    "result_details": scorecards,
                },
            )
            report.details_added += 1
        elif detail.usable_method in DECISION_METHODS and detail.judges and not scorecards:
            report.detail_skipped.append(f"{event.name}: {row.get('fighter_1')} vs {row.get('fighter_2')} had no usable scorecard")
        _remember_fight(tables, row)
        if backfill:
            continue
        if announced is None and already is None:
            existing_bouts.append(row)
        elif announced is not None:
            existing_bouts.append(row)
        added += 1
    report.bouts_added += added
    if key is None and added:
        report.events_added.append(f"{meta['event_name']} ({meta['event_date']}, {added} lutas)")
        if not any(item["event_name"] == meta["event_name"] and item["event_date"] == meta["event_date"] for item in tables.events):
            tables.events.append({"event_name": meta["event_name"], "event_date": meta["event_date"], "event_url": meta.get("event_url", "")})
    elif added:
        report.events_added.append(f"{meta['event_name']} (+{added} lutas)")
    # A completed event no longer belongs in the upcoming list.
    if upcoming_key:
        if failed:
            tables.upcoming[:] = [row for row in tables.upcoming if id(row) not in moved]
        else:
            tables.upcoming[:] = [
                row for row in tables.upcoming if (row["event_name"], row["event_date"]) != upcoming_key
            ]


def apply_weight_overrides(rows: list[dict], overrides: list[dict] | None = None) -> None:
    """Fix bouts ESPN books in the wrong division (data/raw/weight_overrides.csv: fighter_1, fighter_2, weight_class)."""
    if overrides is None:
        overrides = load_csv(WEIGHT_OVERRIDES_PATH)[1] if WEIGHT_OVERRIDES_PATH.exists() else []
    for row in rows:
        for override in overrides:
            if row.get("fighter_1") and same_pair(row["fighter_1"], row["fighter_2"], override["fighter_1"], override["fighter_2"]):
                row["weight_class"] = override["weight_class"]


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
    apply_weight_overrides(rebuilt)
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
    fetch_result: Callable[[EspnEvent, EspnBout], BoutDetail | tuple],
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

    def fetch_bout(self, event: EspnEvent, bout: EspnBout) -> BoutDetail:
        """Method, referee and, for decisions, judge scorecards. A failed call leaves that piece blank."""
        detail = BoutDetail(num_rounds=bout.scheduled_rounds)
        base = f"{CORE_URL}/events/{event.espn_id}/competitions/{bout.competition_id}"
        try:
            time.sleep(REQUEST_DELAY_SECONDS)
            status = self.get_json(f"{base}/status?lang=en")
        except RuntimeError:
            return detail
        if not isinstance(status, dict):
            return detail
        result = status.get("result") if isinstance(status.get("result"), dict) else None
        method, method_detail = map_result(result)
        detail.method = method if method in KNOWN_METHODS else ""
        detail.method_detail = method_detail if detail.method else ""
        detail.result = RESULT_LABELS.get(detail.method, "")
        try:
            time.sleep(REQUEST_DELAY_SECONDS)
            detail.referee, detail.judges = parse_officials(self.get_json(f"{base}/officials?lang=en"))
        except RuntimeError:
            pass
        if detail.method not in DECISION_METHODS:
            return detail
        for fighter in bout.fighters:
            if not str(fighter.espn_id).isdigit():
                continue
            try:
                time.sleep(REQUEST_DELAY_SECONDS)
                detail.scores[fighter.espn_id] = parse_judge_scores(
                    self.get_json(f"{base}/competitors/{fighter.espn_id}/linescores?lang=en")
                )
            except RuntimeError:
                detail.scores[fighter.espn_id] = {}
        return detail

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
        ("details", FIGHT_DETAILS_PATH, FIGHT_DETAIL_FIELDS),
    ):
        if path.exists():
            headers[name], data[name] = load_csv(path)
        else:
            headers[name], data[name] = fallback, []
    return Tables(**data), headers


def refresh_problem(before: Tables, after: Tables, events: list[EspnEvent]) -> str | None:
    """An empty or truncated ESPN payload must not overwrite the stored cards and records."""
    if not events:
        return "ESPN scoreboard returned no events"
    if len(after.fighters) < len(before.fighters):
        return f"fighter list shrank from {len(before.fighters)} to {len(after.fighters)}"
    for row in after.upcoming:
        if row.get("fighter_1") and not str(row.get("fighter_2") or "").strip():
            return f"{row.get('event_name')}: a bout is missing a fighter"
        if row.get("fighter_1") and not str(row.get("event_name") or "").strip():
            return "an upcoming bout is missing its event"
    upcoming_before = [row for row in before.upcoming if row.get("fighter_1") and row.get("fighter_2")]
    if upcoming_before and len(after.upcoming) < len(upcoming_before) * 0.6 and not any(not event.completed for event in events):
        return f"upcoming cards dropped from {len(upcoming_before)} to {len(after.upcoming)} with no future events"
    return None


def save_tables(tables: Tables, headers: dict[str, list[str]], before: Tables) -> None:
    for name, path in (
        ("cards", EVENT_CARDS_PATH), ("fights", FIGHTS_PATH), ("events", EVENTS_PATH),
        ("upcoming", UPCOMING_PATH), ("fighters", FIGHTERS_PATH), ("career", CAREER_STATS_PATH),
        ("details", FIGHT_DETAILS_PATH),
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
    print(f"{prefix}Detalhes (arbitro/placar) gravados: {report.details_added}")
    for item in report.detail_skipped:
        print(f"  ! detalhe ignorado: {item}")


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
    if not events:
        raise RuntimeError("ESPN scoreboard returned no events; stored cards and records were left unchanged.")

    report = sync(
        events, tables, since, until, client.fetch_bout, client.fetch_athlete,
        prune=not args.no_prune, update_fighters=not args.no_fighters,
    )
    print_report(report, args.dry_run)
    problem = refresh_problem(before, tables, events)
    if problem:
        raise RuntimeError(f"Refresh left unchanged: {problem}.")
    if args.dry_run:
        return
    save_tables(tables, headers, before)


if __name__ == "__main__":
    main()
