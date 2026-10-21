"""Training data built only from what was known before each fight.

The deployed model was fed each fighter's career totals as they stand today, which include the fight being predicted and
every later one. Here every fight is described by the state of both fighters on the morning of the fight: the history of
earlier fights only, replayed in date order.

What goes in (all from the CSV files in data/raw, nothing from outside the repository):
    event_cards.csv       who fought whom, who won and how: record, streak, finishes, days off, an Elo rating
    fight_stats.csv       strikes, takedowns, knockdowns and control time per fight (ESPN): accuracy, defense, volume
    fight_details.csv     scheduled rounds and whether it was a title fight (known before the bell)
    fighters.csv, fighter_career_stats.csv   date of birth, height, reach, stance (they do not change with the fight)

Rules the code keeps, and tests/ml/test_prefight.py checks:
    - A fight's features never depend on that fight's own result or on any later fight.
    - Fights on the same day do not see each other.
    - Fighter A and fighter B are drawn at random, reproducibly from the fight's url, because the source lists the
      winner first in 99.9% of the fights and has no red or blue corner.
    - No calendar features (year, month): the model cannot learn that the sport changed over time.
    - The same code builds a row for a fight in the past and for a fight tomorrow (replay the history, then ask).
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .config import RAW_DATA_DIR

ELO_START = 1500.0
ELO_K = 24.0
ROUND_SECONDS = 300

# Priors that keep a fighter with two fights from looking like a 100% striker: (landed + prior * strength) / (attempted + strength).
SIG_ACC_PRIOR, SIG_ACC_STRENGTH = 0.45, 100.0
TD_ACC_PRIOR, TD_ACC_STRENGTH = 0.35, 10.0
RATE_PRIOR_MINUTES = 5.0
SIG_PER_MIN_PRIOR = 3.5
TD_PER_15_PRIOR = 1.0
KD_PER_15_PRIOR = 0.2
SUB_PER_15_PRIOR = 0.3

WEIGHT_LIMITS_LBS = {
    "strawweight": 115, "flyweight": 125, "bantamweight": 135, "featherweight": 145, "lightweight": 155,
    "welterweight": 170, "middleweight": 185, "light heavyweight": 205, "heavyweight": 265,
}

STAT_COLUMNS = [
    "knockdowns", "sig_landed", "sig_attempted", "total_landed", "total_attempted", "td_landed", "td_attempted",
    "submission_attempts", "reversals", "advances", "control_seconds",
]

# What describes one fighter before a fight; the model sees A minus B for each of these.
FIGHTER_FEATURES = [
    "age", "height", "reach", "ufc_fights", "ufc_wins", "ufc_losses", "streak", "days_off", "finish_rate", "ko_losses",
    "elo", "form", "sig_acc", "sig_def", "sig_per_min", "sig_absorbed_per_min", "td_acc", "td_def", "td_per_15",
    "kd_per_15", "control_share", "sub_per_15",
]
DIFF_FEATURES = [f"{name}_diff" for name in FIGHTER_FEATURES]
CONTEXT_FEATURES = ["same_stance", "scheduled_rounds", "title_fight", "weight_lbs", "womens", "age_sum", "fights_sum"]
FEATURE_COLUMNS = DIFF_FEATURES + CONTEXT_FEATURES


# --------------------------------------------------------------------------- names and static attributes


def name_key(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def parse_height_cm(value: object) -> float:
    match = re.match(r"\s*(\d+)'\s*(\d+)", str(value))
    return int(match.group(1)) * 30.48 + int(match.group(2)) * 2.54 if match else math.nan


def parse_reach_cm(value: object) -> float:
    match = re.match(r"\s*(\d+(?:\.\d+)?)", str(value))
    return float(match.group(1)) * 2.54 if match else math.nan


def parse_day(value: object) -> date | None:
    try:
        return datetime.strptime(str(value), "%B %d, %Y").date()
    except ValueError:
        return None


@dataclass(frozen=True)
class Static:
    """What does not change from fight to fight."""

    dob: date | None = None
    height: float = math.nan
    reach: float = math.nan
    stance: str = ""


def build_statics(fighters: pd.DataFrame, career: pd.DataFrame, aliases: dict[str, str]) -> dict[str, Static]:
    """Static attributes by name key. A name shared by two fighters is left out: it cannot be told apart."""
    frame = fighters.copy()
    frame["key"] = (frame["first_name"].fillna("") + " " + frame["last_name"].fillna("")).map(name_key)
    frame = frame[~frame["key"].duplicated(keep=False)]
    dob_by_url = pd.to_datetime(career.set_index("fighter_url")["dob"].replace({"--": ""}), errors="coerce", format="mixed")
    statics: dict[str, Static] = {}
    for row in frame.itertuples():
        dob = dob_by_url.get(row.fighter_url)
        statics[row.key] = Static(
            dob=None if dob is None or pd.isna(dob) else dob.date(),
            height=parse_height_cm(row.height),
            reach=parse_reach_cm(row.reach),
            stance=str(row.stance).strip(),
        )
    for alias, canonical in aliases.items():
        if canonical in statics and alias not in statics:
            statics[alias] = statics[canonical]
    return statics


# --------------------------------------------------------------------------- one fighter's history


@dataclass
class FighterState:
    fights: int = 0
    wins: int = 0
    losses: int = 0
    streak: int = 0
    last_date: date | None = None
    ko_losses: int = 0
    finish_wins: int = 0
    elo: float = ELO_START
    recent: list[float] = field(default_factory=list)
    # statistics, over the fights ESPN has numbers for
    stat_fights: int = 0
    minutes: float = 0.0
    sig_landed: float = 0.0
    sig_attempted: float = 0.0
    sig_absorbed: float = 0.0
    sig_absorbed_attempted: float = 0.0
    td_landed: float = 0.0
    td_attempted: float = 0.0
    td_absorbed: float = 0.0
    td_absorbed_attempted: float = 0.0
    knockdowns: float = 0.0
    control_seconds: float = 0.0
    submission_attempts: float = 0.0

    def copy(self) -> "FighterState":
        clone = FighterState(**{k: v for k, v in self.__dict__.items() if k != "recent"})
        clone.recent = list(self.recent)
        return clone


def _shrunk(landed: float, attempted: float, prior: float, strength: float) -> float:
    return (landed + prior * strength) / (attempted + strength)


def _rate(count: float, minutes: float, prior_per_15: float, per: float = 15.0) -> float:
    """A per-`per`-minute rate pulled toward a typical value while there are few minutes behind it."""
    return (count + prior_per_15 * RATE_PRIOR_MINUTES / 15.0) / (minutes + RATE_PRIOR_MINUTES) * per


def fighter_features(state: FighterState, static: Static, on: date) -> dict[str, float]:
    nan = math.nan
    has_stats = state.stat_fights > 0
    minutes = state.minutes
    return {
        "age": (on - static.dob).days / 365.25 if static.dob else nan,
        "height": static.height,
        "reach": static.reach,
        "ufc_fights": float(state.fights),
        "ufc_wins": float(state.wins),
        "ufc_losses": float(state.losses),
        "streak": float(state.streak),
        "days_off": float((on - state.last_date).days) if state.last_date else nan,
        "finish_rate": state.finish_wins / state.wins if state.wins else nan,
        "ko_losses": float(state.ko_losses),
        "elo": state.elo,
        "form": float(np.mean(state.recent[-3:])) if state.recent else nan,
        "sig_acc": _shrunk(state.sig_landed, state.sig_attempted, SIG_ACC_PRIOR, SIG_ACC_STRENGTH) if has_stats else nan,
        "sig_def": 1 - _shrunk(state.sig_absorbed, state.sig_absorbed_attempted, SIG_ACC_PRIOR, SIG_ACC_STRENGTH) if has_stats else nan,
        "sig_per_min": _rate(state.sig_landed, minutes, SIG_PER_MIN_PRIOR * 15, per=1.0) if has_stats else nan,
        "sig_absorbed_per_min": _rate(state.sig_absorbed, minutes, SIG_PER_MIN_PRIOR * 15, per=1.0) if has_stats else nan,
        "td_acc": _shrunk(state.td_landed, state.td_attempted, TD_ACC_PRIOR, TD_ACC_STRENGTH) if has_stats else nan,
        "td_def": 1 - _shrunk(state.td_absorbed, state.td_absorbed_attempted, TD_ACC_PRIOR, TD_ACC_STRENGTH) if has_stats else nan,
        "td_per_15": _rate(state.td_landed, minutes, TD_PER_15_PRIOR) if has_stats else nan,
        "kd_per_15": _rate(state.knockdowns, minutes, KD_PER_15_PRIOR) if has_stats else nan,
        "control_share": state.control_seconds / (minutes * 60) if has_stats and minutes > 0 else nan,
        "sub_per_15": _rate(state.submission_attempts, minutes, SUB_PER_15_PRIOR) if has_stats else nan,
    }


def consistent(numbers: dict[str, float]) -> bool:
    """ESPN has a few fights (0.1%) with strikes landed but none attempted. Such numbers cannot give an accuracy."""
    return numbers["sig_landed"] <= numbers["sig_attempted"] and numbers["td_landed"] <= numbers["td_attempted"] and numbers["total_landed"] <= numbers["total_attempted"]


def fight_seconds(round_value: object, time_value: object) -> float | None:
    """How long the fight lasted, from the round it ended in and the clock."""
    try:
        rounds = int(float(round_value))
        minutes, seconds = str(time_value).split(":")
        return (rounds - 1) * ROUND_SECONDS + int(minutes) * 60 + int(seconds)
    except (ValueError, TypeError):
        return None


@dataclass
class Fight:
    """One finished fight, in the form the history is replayed from."""

    day: date
    fight_url: str
    first: str  # name keys
    second: str
    winner: str  # a name key, or "" for a draw or no contest
    method: str = ""
    seconds: float | None = None
    stats: dict[str, dict[str, float]] = field(default_factory=dict)  # name key -> numbers, only when ESPN has them
    scheduled_rounds: float = math.nan
    title_fight: float = 0.0
    weight_class: str = ""
    first_name: str = ""
    second_name: str = ""


class HistoryTracker:
    """Replays fights in date order. `snapshot` is what was known before a day; `apply` adds a day's fights."""

    def __init__(self) -> None:
        self.states: dict[str, FighterState] = {}

    def snapshot(self, who: str) -> FighterState:
        return self.states.get(who, FighterState()).copy()

    def apply(self, fights: list[Fight], before: dict[str, FighterState]) -> None:
        """Add one day's fights. `before` holds both fighters as they were before any of them (so the order of the
        fights inside a day does not matter, and Elo is updated from the pre-day ratings)."""
        for fight in fights:
            for who, opponent in ((fight.first, fight.second), (fight.second, fight.first)):
                state = self.states.setdefault(who, FighterState())
                state.fights += 1
                state.last_date = fight.day
                if not fight.winner:
                    state.streak = 0
                    state.recent.append(0.5)
                elif fight.winner == who:
                    state.wins += 1
                    state.streak = max(state.streak, 0) + 1
                    state.finish_wins += fight.method.startswith(("KO", "SUB"))
                    state.recent.append(1.0)
                else:
                    state.losses += 1
                    state.streak = min(state.streak, 0) - 1
                    state.ko_losses += fight.method.startswith("KO")
                    state.recent.append(0.0)
                own, other = fight.stats.get(who), fight.stats.get(opponent)
                if own and other and fight.seconds:
                    state.stat_fights += 1
                    state.minutes += fight.seconds / 60
                    state.sig_landed += own["sig_landed"]
                    state.sig_attempted += own["sig_attempted"]
                    state.sig_absorbed += other["sig_landed"]
                    state.sig_absorbed_attempted += other["sig_attempted"]
                    state.td_landed += own["td_landed"]
                    state.td_attempted += own["td_attempted"]
                    state.td_absorbed += other["td_landed"]
                    state.td_absorbed_attempted += other["td_attempted"]
                    state.knockdowns += own["knockdowns"]
                    state.control_seconds += own["control_seconds"]
                    state.submission_attempts += own["submission_attempts"]
            if fight.winner:
                rating_first, rating_second = before[fight.first].elo, before[fight.second].elo
                expected = 1 / (1 + 10 ** ((rating_second - rating_first) / 400))
                score = 1.0 if fight.winner == fight.first else 0.0
                self.states[fight.first].elo += ELO_K * (score - expected)
                self.states[fight.second].elo += ELO_K * ((1 - score) - (1 - expected))


# --------------------------------------------------------------------------- one matchup -> one row


def weight_features(weight_class: str) -> tuple[float, float]:
    """(limit in lbs, is a women's division) from a weight class name; catch weights have no limit."""
    text = str(weight_class or "").lower()
    womens = 1.0 if "women" in text else 0.0
    for name in sorted(WEIGHT_LIMITS_LBS, key=len, reverse=True):
        if name in text:
            return float(WEIGHT_LIMITS_LBS[name]), womens
    return math.nan, womens


def matchup_row(
    a: FighterState, static_a: Static, b: FighterState, static_b: Static, on: date,
    scheduled_rounds: float = math.nan, title_fight: float = 0.0, weight_class: str = "",
) -> dict[str, float]:
    """The model's input for fighter A against fighter B on a day, from their states before that day."""
    fa, fb = fighter_features(a, static_a, on), fighter_features(b, static_b, on)
    row = {f"{name}_diff": fa[name] - fb[name] for name in FIGHTER_FEATURES}
    weight_lbs, womens = weight_features(weight_class)
    row.update(
        same_stance=float(bool(static_a.stance) and static_a.stance == static_b.stance),
        scheduled_rounds=scheduled_rounds, title_fight=title_fight, weight_lbs=weight_lbs, womens=womens,
        age_sum=fa["age"] + fb["age"], fights_sum=fa["ufc_fights"] + fb["ufc_fights"],
    )
    return row


def a_is_first(fight_url: str) -> bool:
    """Which of the two listed fighters is "A": a coin flip that depends only on the fight's url, so it is the same on
    every run and does not follow the source's habit of listing the winner first."""
    return int(hashlib.sha1(fight_url.encode("utf-8")).hexdigest(), 16) % 2 == 0


def mirror(frame: pd.DataFrame) -> pd.DataFrame:
    """The same fights seen from the other fighter: differences change sign and the label flips."""
    flipped = frame.copy()
    for column in DIFF_FEATURES:
        flipped[column] = -flipped[column]
    flipped["y"] = 1 - flipped["y"]
    return flipped


# --------------------------------------------------------------------------- the whole history


def load_fights(
    cards: pd.DataFrame, details: pd.DataFrame, stats: pd.DataFrame | None, aliases: dict[str, str],
) -> list[Fight]:
    """Every past fight as a Fight, sorted by day. `stats` is fight_stats.csv (or None)."""
    alias = lambda n: aliases.get(name_key(n), name_key(n))  # noqa: E731
    detail = details.drop_duplicates("fight_url").set_index("fight_url") if len(details) else pd.DataFrame()
    stat_rows: dict[str, dict[str, dict[str, float]]] = {}
    if stats is not None and len(stats):
        for row in stats.itertuples(index=False):
            numbers = {column: float(getattr(row, column) or 0) for column in STAT_COLUMNS}
            stat_rows.setdefault(row.fight_url, {})[alias(row.fighter)] = numbers

    fights: list[Fight] = []
    for row in cards.itertuples(index=False):
        day = parse_day(row.event_date)
        if day is None or not row.fight_url:
            continue
        first, second = alias(row.fighter_1), alias(row.fighter_2)
        winner = alias(row.winner) if str(row.winner).strip() else ""
        scheduled, title = math.nan, 0.0
        if row.fight_url in detail.index:
            scheduled = pd.to_numeric(detail.at[row.fight_url, "num_rounds"], errors="coerce")
            title = float(str(detail.at[row.fight_url, "title_fight"]).strip().lower() in {"true", "1", "yes"})
        stats_for_fight = stat_rows.get(row.fight_url, {})
        fights.append(
            Fight(
                day=day, fight_url=row.fight_url, first=first, second=second, winner=winner,
                method=str(row.method), seconds=fight_seconds(row.round, row.time),
                stats=stats_for_fight
                if first in stats_for_fight and second in stats_for_fight and all(consistent(n) for n in stats_for_fight.values())
                else {},
                scheduled_rounds=float(scheduled) if pd.notna(scheduled) else math.nan, title_fight=title,
                weight_class=str(row.weight_class), first_name=str(row.fighter_1), second_name=str(row.fighter_2),
            )
        )
    fights.sort(key=lambda f: (f.day, f.fight_url))
    return fights


def build_dataset(fights: list[Fight], statics: dict[str, Static], keep_sides: bool = False) -> pd.DataFrame:
    """One row per fight with a winner: the features from before the fight, and y = 1 when fighter A won.

    `keep_sides` also keeps each fighter's own values (columns a__age, b__age ...), for comparisons and diagnostics;
    the model only ever sees FEATURE_COLUMNS."""
    tracker = HistoryTracker()
    rows: list[dict] = []
    by_day: dict[date, list[Fight]] = {}
    for fight in fights:
        by_day.setdefault(fight.day, []).append(fight)

    for day in sorted(by_day):
        todays = by_day[day]
        before: dict[str, FighterState] = {}
        for fight in todays:
            for who in (fight.first, fight.second):
                before[who] = tracker.snapshot(who)
        for fight in todays:
            if not fight.winner or fight.first not in statics or fight.second not in statics:
                continue
            a_first = a_is_first(fight.fight_url)
            a, b = (fight.first, fight.second) if a_first else (fight.second, fight.first)
            row = matchup_row(
                before[a], statics[a], before[b], statics[b], day,
                scheduled_rounds=fight.scheduled_rounds, title_fight=fight.title_fight, weight_class=fight.weight_class,
            )
            row.update(
                date=pd.Timestamp(day), fight_url=fight.fight_url,
                fighter_a=fight.first_name if a_first else fight.second_name,
                fighter_b=fight.second_name if a_first else fight.first_name,
                key_a=a, key_b=b, y=int(fight.winner == a),
            )
            if keep_sides:
                for prefix, who in (("a", a), ("b", b)):
                    for name, value in fighter_features(before[who], statics[who], day).items():
                        row[f"{prefix}__{name}"] = value
            rows.append(row)
        tracker.apply(todays, before)
    return pd.DataFrame(rows).sort_values(["date", "fight_url"]).reset_index(drop=True)


def replay(fights: list[Fight]) -> HistoryTracker:
    """The state of every fighter after all the given fights: what to ask a prediction about tomorrow's fight."""
    tracker = HistoryTracker()
    by_day: dict[date, list[Fight]] = {}
    for fight in fights:
        by_day.setdefault(fight.day, []).append(fight)
    for day in sorted(by_day):
        todays = by_day[day]
        before = {who: tracker.snapshot(who) for fight in todays for who in (fight.first, fight.second)}
        tracker.apply(todays, before)
    return tracker


# --------------------------------------------------------------------------- reading the repository's files


@dataclass
class RawTables:
    cards: pd.DataFrame
    details: pd.DataFrame
    fighters: pd.DataFrame
    career: pd.DataFrame
    stats: pd.DataFrame | None
    aliases: dict[str, str]


def load_raw(raw_dir: Path = RAW_DATA_DIR) -> RawTables:
    def read(name: str) -> pd.DataFrame:
        return pd.read_csv(raw_dir / name, keep_default_na=False, dtype=str)

    stats_path = raw_dir / "fight_stats.csv"
    aliases_frame = read("name_aliases.csv")
    return RawTables(
        cards=read("event_cards.csv"), details=read("fight_details.csv"), fighters=read("fighters.csv"),
        career=read("fighter_career_stats.csv"), stats=read("fight_stats.csv") if stats_path.exists() else None,
        aliases={name_key(a): name_key(c) for a, c in zip(aliases_frame["alias"], aliases_frame["canonical"])},
    )


def build_from_repository(raw_dir: Path = RAW_DATA_DIR, keep_sides: bool = False) -> tuple[pd.DataFrame, list[Fight], dict[str, Static]]:
    tables = load_raw(raw_dir)
    fights = load_fights(tables.cards, tables.details, tables.stats, tables.aliases)
    statics = build_statics(tables.fighters, tables.career, tables.aliases)
    return build_dataset(fights, statics, keep_sides=keep_sides), fights, statics
