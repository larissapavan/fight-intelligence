from __future__ import annotations

import re
import unicodedata
from collections import deque
from datetime import datetime

import pandas as pd

from backend.app.services.bmf_service import BMF_FIGHTS_SOURCE_PATH, is_bmf_title_fight
from backend.app.services.catalog_service import _normalize_name, get_fighter_catalog
from src.ufc_predictor.config import RAW_DATA_DIR

TITLE_REIGNS_SOURCE_PATH = RAW_DATA_DIR / "title_reigns.csv"

MAX_NETWORK_DEPTH = 6

EVENT_CARDS_SOURCE_PATH = RAW_DATA_DIR / "event_cards.csv"
FIGHT_DETAILS_SOURCE_PATH = RAW_DATA_DIR / "fight_details.csv"
DETAIL_COLUMNS = ["referee", "num_rounds", "title_fight", "result", "result_details"]

METHOD_BUCKETS = {
    "KO/TKO": "KO/TKO",
    "SUB": "Submission",
    "U-DEC": "Decision",
    "S-DEC": "Decision",
    "M-DEC": "Decision",
    "DQ": "Disqualification",
}

_cache: dict = {"signature": None, "data": None}
_interim_wins_cache: dict = {"signature": "unset", "wins": frozenset()}


def _source_signature() -> tuple | None:
    if not EVENT_CARDS_SOURCE_PATH.exists():
        return None
    details = FIGHT_DETAILS_SOURCE_PATH.stat().st_mtime_ns if FIGHT_DETAILS_SOURCE_PATH.exists() else None
    bmf = BMF_FIGHTS_SOURCE_PATH.stat().st_mtime_ns if BMF_FIGHTS_SOURCE_PATH.exists() else None
    return (EVENT_CARDS_SOURCE_PATH.stat().st_mtime_ns, details, bmf)


def _fold(name: str) -> str:
    """Name key that ignores accents: title_reigns.csv writes "José Aldo", the fight history "Jose Aldo"."""
    return _normalize_name(unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode())


def _pair_key(fighter_1: str, fighter_2: str) -> tuple[str, str]:
    first, second = sorted([_fold(fighter_1), _fold(fighter_2)])
    return first, second


_TITLE_OVERRIDE_PAIRS = {
    _pair_key("Carlos Prates", "Michael Morales"): {"title_fight": True, "interim_title": True},
    _pair_key("Petr Yan", "Merab Dvalishvili"): {"title_fight": True, "interim_title": False},
    _pair_key("Alexander Volkanovski", "Movsar Evloev"): {"title_fight": True, "interim_title": False},
}


def _is_interim_title(fighter_a: str, fighter_b: str, interim_win: bool) -> bool:
    pair = _pair_key(fighter_a, fighter_b)
    if pair in _TITLE_OVERRIDE_PAIRS and "interim_title" in _TITLE_OVERRIDE_PAIRS[pair]:
        return _TITLE_OVERRIDE_PAIRS[pair]["interim_title"]
    return bool(interim_win)


def _is_title_fight(row: pd.Series, fighter_a: str, fighter_b: str, interim_win: bool) -> bool | None:
    pair = _pair_key(fighter_a, fighter_b)
    if pair in _TITLE_OVERRIDE_PAIRS and "title_fight" in _TITLE_OVERRIDE_PAIRS[pair]:
        return _TITLE_OVERRIDE_PAIRS[pair]["title_fight"]
    tf = _to_bool(row.get("title_fight"))
    if tf:
        return True
    if _is_interim_title(fighter_a, fighter_b, interim_win):
        return True
    return tf


_DEFENSE = re.compile(r"def\.\s+.+?\s+at\s+(?P<event>.+?)\s+on\s+(?P<date>[A-Z][a-z]{2} \d{1,2}, \d{4})")


def _interim_title_wins() -> frozenset[tuple[str, str]]:
    """Keys of every fight the interim champion won with the interim belt at stake: (champion, ISO date) and
    (champion, event name). That is the fight that won it, and each defense listed in defenses_detail.

    A reign's date_won is the date of that fight, but the local date can differ by a day from the event date, so the
    event name ("UFC 284") is a second way to find the fight."""
    signature = TITLE_REIGNS_SOURCE_PATH.stat().st_mtime_ns if TITLE_REIGNS_SOURCE_PATH.exists() else None
    if _interim_wins_cache["signature"] != signature:
        wins: set[tuple[str, str]] = set()
        if signature is not None:
            reigns = pd.read_csv(TITLE_REIGNS_SOURCE_PATH, keep_default_na=False)
            for row in reigns[reigns["title_type"].astype(str).str.strip().eq("interim")].itertuples(index=False):
                who = _fold(row.champion)
                wins.add((who, str(row.date_won).strip()))
                if str(row.event).strip():
                    wins.add((who, str(row.event).strip()))
                for defense in str(row.defenses_detail).split(";"):
                    found = _DEFENSE.search(defense)
                    if found:
                        wins.add((who, found["event"].strip()))
                        try:
                            wins.add((who, datetime.strptime(found["date"], "%b %d, %Y").date().isoformat()))
                        except ValueError:
                            pass
        _interim_wins_cache.update(signature=signature, wins=frozenset(wins))
    return _interim_wins_cache["wins"]


def _won_interim(wins: frozenset[tuple[str, str]], who: str, date_iso: str | None, event_name: str) -> bool:
    event = str(event_name)
    return (who, date_iso) in wins or any(
        key == who and (event == other or event.startswith(f"{other}:")) for key, other in wins
    )


def _load_fight_history() -> pd.DataFrame:
    signature = _source_signature()
    if _cache["signature"] != signature:
        if not EVENT_CARDS_SOURCE_PATH.exists():
            df = pd.DataFrame()
        else:
            df = pd.read_csv(EVENT_CARDS_SOURCE_PATH)
            if FIGHT_DETAILS_SOURCE_PATH.exists():
                details = pd.read_csv(FIGHT_DETAILS_SOURCE_PATH, keep_default_na=False)
                details = details.drop_duplicates(subset=["fight_url"], keep="last")[["fight_url", *DETAIL_COLUMNS]]
                df = df.merge(details.rename(columns={"result": "outcome"}), on="fight_url", how="left")
            df["event_date_parsed"] = pd.to_datetime(df["event_date"], format="%B %d, %Y", errors="coerce")
            df["key_1"] = df["fighter_1"].apply(_normalize_name)
            df["key_2"] = df["fighter_2"].apply(_normalize_name)
        _cache["data"] = df
        _cache["signature"] = signature
    return _cache["data"]


def get_fights_for_fighter(name: str) -> list[dict]:
    """All fights for one fighter, most recent first."""
    df = _load_fight_history()
    if df.empty:
        return []

    key = _normalize_name(name)
    rows = df[(df["key_1"] == key) | (df["key_2"] == key)]
    rows = rows.sort_values("event_date_parsed", ascending=False, na_position="last")

    interim_wins = _interim_title_wins()
    fights: list[dict] = []
    for _, row in rows.iterrows():
        is_fighter_1 = row["key_1"] == key
        opponent_name = row["fighter_2"] if is_fighter_1 else row["fighter_1"]
        winner = row.get("winner")

        result = None
        if pd.notna(winner):
            result = "win" if _normalize_name(winner) == key else "loss"

        date_parsed = row["event_date_parsed"]
        date_iso = date_parsed.date().isoformat() if pd.notna(date_parsed) else None
        fights.append(
            {
                "event_name": row["event_name"],
                "date": date_parsed.date().isoformat() if pd.notna(date_parsed) else None,
                "opponent": opponent_name,
                "result": result,
                "weight_class": _nullable(row.get("weight_class")),
                "method": _nullable(row.get("method")),
                "method_detail": _nullable(row.get("method_detail")),
                "round": _to_int(row.get("round")),
                "time": _nullable(row.get("time")),
                "winner": _nullable(winner),
                "location": _nullable(row.get("location")),
                "fight_url": _nullable(row.get("fight_url")),
                "referee": _nullable(row.get("referee")),
                "num_rounds": _to_int(row.get("num_rounds")),
                "title_fight": _is_title_fight(row, name, opponent_name, pd.notna(winner) and _won_interim(interim_wins, _fold(winner), date_iso, row["event_name"])),
                "bmf_title": is_bmf_title_fight(_nullable(row.get("fight_url"))),
                "interim_title": _is_interim_title(name, opponent_name, pd.notna(winner) and _won_interim(interim_wins, _fold(winner), date_iso, row["event_name"])),
                "interim_title_win": result == "win" and _is_interim_title(name, opponent_name, pd.notna(winner) and _won_interim(interim_wins, _fold(winner), date_iso, row["event_name"])),
                "outcome": _nullable(row.get("outcome")),
                "result_details": _nullable(row.get("result_details")),
            }
        )
    return fights


def get_opponents(name: str) -> list[dict]:
    """Everyone the fighter has faced in the UFC, most recent opponent first, with how many times they met."""
    fights = get_fights_for_fighter(name) or get_fights_for_fighter(name.replace(".", ""))
    opponents: dict[str, dict] = {}
    for fight in fights:  # most recent first, so the first sighting is the latest meeting
        key = _normalize_name(fight["opponent"])
        entry = opponents.setdefault(key, {"name": fight["opponent"], "fights": 0, "last_date": fight["date"]})
        entry["fights"] += 1
    return list(opponents.values())


def get_head_to_head(fighter_a: str, fighter_b: str) -> dict:
    fights_a = get_fights_for_fighter(fighter_a)
    key_b = _normalize_name(fighter_b)
    meetings = [fight for fight in fights_a if _normalize_name(fight["opponent"]) == key_b]

    network = get_network_path(fighter_a, fighter_b)

    return {
        "fighter_a": fighter_a,
        "fighter_b": fighter_b,
        "fighter_a_wins": sum(1 for m in meetings if m["result"] == "win"),
        "fighter_b_wins": sum(1 for m in meetings if m["result"] == "loss"),
        "no_contests": sum(1 for m in meetings if m["result"] is None),
        "meetings": meetings,
        "common_opponents": get_common_opponents(fighter_a, fighter_b),
        "network_path": network["path"],
        "degrees_of_separation": network["degrees_of_separation"],
    }


_graph_cache: dict = {"signature": None, "adjacency": None}


def _build_fight_graph() -> dict[str, set[str]]:
    """Undirected graph of the real 'who fought whom' network (event_cards.csv).

    Used for common-opponents lookups and shortest-path (degrees of separation)
    between two fighters who never fought each other directly.
    """
    signature = _source_signature()
    if _graph_cache["signature"] != signature:
        df = _load_fight_history()
        adjacency: dict[str, set[str]] = {}
        if not df.empty:
            for key_1, key_2 in zip(df["key_1"], df["key_2"]):
                if not key_1 or not key_2 or key_1 == key_2:
                    continue
                adjacency.setdefault(key_1, set()).add(key_2)
                adjacency.setdefault(key_2, set()).add(key_1)
        _graph_cache["adjacency"] = adjacency
        _graph_cache["signature"] = signature
    return _graph_cache["adjacency"]


def get_common_opponents(fighter_a: str, fighter_b: str) -> list[dict]:
    """Opponents both fighters have faced, with each fighter's result against them."""
    adjacency = _build_fight_graph()
    key_a = _normalize_name(fighter_a)
    key_b = _normalize_name(fighter_b)
    shared_keys = adjacency.get(key_a, set()) & adjacency.get(key_b, set())
    if not shared_keys:
        return []

    fights_a = {_normalize_name(fight["opponent"]): fight for fight in get_fights_for_fighter(fighter_a)}
    fights_b = {_normalize_name(fight["opponent"]): fight for fight in get_fights_for_fighter(fighter_b)}

    common = []
    for key in shared_keys:
        fight_a = fights_a.get(key)
        fight_b = fights_b.get(key)
        if not fight_a or not fight_b:
            continue
        common.append(
            {
                "opponent": fight_a["opponent"],
                "fighter_a_result": fight_a["result"],
                "fighter_b_result": fight_b["result"],
            }
        )
    common.sort(key=lambda item: item["opponent"])
    return common


def get_network_path(fighter_a: str, fighter_b: str) -> dict:
    """Shortest chain of common opponents connecting two fighters (BFS), capped at
    MAX_NETWORK_DEPTH hops so the result stays meaningful ('how are they connected'
    stops being interesting well before 6+ degrees).
    """
    adjacency = _build_fight_graph()
    key_a = _normalize_name(fighter_a)
    key_b = _normalize_name(fighter_b)

    if key_a == key_b:
        return {"path": [fighter_a], "degrees_of_separation": 0}
    if key_a not in adjacency or key_b not in adjacency:
        return {"path": [], "degrees_of_separation": None}

    visited = {key_a}
    queue: deque[tuple[str, list[str]]] = deque([(key_a, [key_a])])

    while queue:
        current, path = queue.popleft()
        if len(path) - 1 >= MAX_NETWORK_DEPTH:
            continue
        for neighbor in adjacency.get(current, set()):
            if neighbor in visited:
                continue
            next_path = [*path, neighbor]
            if neighbor == key_b:
                return {"path": _resolve_display_names(next_path), "degrees_of_separation": len(next_path) - 1}
            visited.add(neighbor)
            queue.append((neighbor, next_path))

    return {"path": [], "degrees_of_separation": None}


def _resolve_display_names(profile_keys: list[str]) -> list[str]:
    catalog = get_fighter_catalog()
    lookup = dict(zip(catalog["profile_key"], catalog["name"]))
    return [lookup.get(key, key) for key in profile_keys]


def get_fighter_performance(name: str) -> dict:
    fights = get_fights_for_fighter(name)
    wins = [fight for fight in fights if fight["result"] == "win"]
    losses = [fight for fight in fights if fight["result"] == "loss"]

    method_breakdown: dict[str, int] = {}
    for fight in wins:
        bucket = METHOD_BUCKETS.get(fight["method"] or "", "Other")
        method_breakdown[bucket] = method_breakdown.get(bucket, 0) + 1

    round_distribution: dict[int, int] = {}
    finish_seconds: list[int] = []
    for fight in wins:
        if fight["round"]:
            round_distribution[fight["round"]] = round_distribution.get(fight["round"], 0) + 1
        seconds = _time_to_seconds(fight["time"], fight["round"])
        if seconds is not None:
            finish_seconds.append(seconds)

    avg_win_seconds = round(sum(finish_seconds) / len(finish_seconds)) if finish_seconds else None

    weight_class_history: list[str] = []
    for fight in reversed(fights):  # oldest first
        weight_class = fight["weight_class"]
        if weight_class and (not weight_class_history or weight_class_history[-1] != weight_class):
            weight_class_history.append(weight_class)

    try:
        from backend.app.services.events_service import get_fighter_upcoming_bouts
        upcoming = get_fighter_upcoming_bouts(name)
    except Exception:
        upcoming = []

    return {
        "fighter": name,
        "total_fights": len(fights),
        "wins": len(wins),
        "losses": len(losses),
        "method_breakdown": method_breakdown,
        "round_distribution": round_distribution,
        "avg_win_time_seconds": avg_win_seconds,
        "weight_class_history": weight_class_history,
        "last_performances": fights[:5],
        "career_timeline": list(reversed(fights)),  # oldest first, for chronological display
        "yearly_trends": _build_yearly_trends(fights),
        "next_fight": upcoming[0] if upcoming else None,
        "upcoming_fights": upcoming,
    }


def _build_yearly_trends(fights: list[dict]) -> list[dict]:
    """Year-by-year trend lines, built only from what event_cards.csv actually records
    (date, result, method, round, time) — no striking/takedown stats are available per fight.
    """
    fights_by_year: dict[int, list[dict]] = {}
    for fight in fights:
        if not fight["date"]:
            continue
        year = int(fight["date"][:4])
        fights_by_year.setdefault(year, []).append(fight)

    trends: list[dict] = []
    for year in sorted(fights_by_year):
        year_fights = fights_by_year[year]
        wins = [fight for fight in year_fights if fight["result"] == "win"]
        losses = [fight for fight in year_fights if fight["result"] == "loss"]
        decided = len(wins) + len(losses)

        finishes = [
            fight for fight in wins if METHOD_BUCKETS.get(fight["method"] or "", "Other") in ("KO/TKO", "Submission")
        ]

        round_distribution: dict[int, int] = {}
        finish_seconds: list[int] = []
        for fight in wins:
            if fight["round"]:
                round_distribution[fight["round"]] = round_distribution.get(fight["round"], 0) + 1
            seconds = _time_to_seconds(fight["time"], fight["round"])
            if seconds is not None:
                finish_seconds.append(seconds)

        trends.append(
            {
                "year": year,
                "fights": len(year_fights),
                "wins": len(wins),
                "losses": len(losses),
                "win_rate": round(len(wins) / decided, 4) if decided else None,
                "finish_rate": round(len(finishes) / len(wins), 4) if wins else None,
                "avg_win_time_seconds": round(sum(finish_seconds) / len(finish_seconds)) if finish_seconds else None,
                "round_distribution": round_distribution,
            }
        )
    return trends


def _time_to_seconds(time_text: str | None, round_number: int | None) -> int | None:
    """Total fight-clock seconds elapsed at the finish (round-adjusted, 5-min rounds)."""
    if not time_text or ":" not in time_text:
        return None
    try:
        minutes, seconds = time_text.split(":")
        round_seconds = (int(round_number) - 1) * 5 * 60 if round_number else 0
        return round_seconds + int(minutes) * 60 + int(seconds)
    except ValueError:
        return None


def _nullable(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _to_int(value) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_bool(value) -> bool | None:
    text = _nullable(value)
    return None if text is None else text.lower() == "true"
