"""Fighters, events and rankings of every organisation other than the UFC.

The UFC has its own, richer pipeline (catalog_service, events_service...). Every other organisation is described by
three CSV files in data/raw/<org>/, written by its scraper (scripts/scrape_pfl.py is the first one):

    fights.csv    one row per bout, announced or fought, with the event on every row
    fighters.csv  one row per fighter
    rankings.csv  divisional rankings; rank 0 is the champion

Adding an organisation means writing a scraper that produces those files and adding an entry to ORGS.
"""

from __future__ import annotations

import csv
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from src.ufc_predictor.config import RAW_DATA_DIR


@dataclass(frozen=True)
class Org:
    id: str
    name: str
    short_name: str
    tagline: str
    sources: tuple[str, ...]
    root: Path | None = None  # where the CSV files are, when not data/raw/<id> (tests)

    @property
    def data_dir(self) -> Path:
        return self.root or RAW_DATA_DIR / self.id


ORGS: dict[str, Org] = {
    "pfl": Org(
        id="pfl",
        name="Professional Fighters League",
        short_name="PFL",
        tagline="PFL fighters, event results and rankings.",
        sources=("pflmma.com",),
    ),
    "bellator": Org(
        id="bellator",
        name="Bellator MMA",
        short_name="Bellator",
        tagline="The Bellator archive: every event from 2009 to 2023, its fighters and its champions.",
        sources=("espn.com", "wikipedia.org"),
    ),
}

# Lightest to heaviest, men's divisions first, then women's. Anything unknown goes last in the order it was scraped.
DIVISION_ORDER = [
    "Flyweight", "Bantamweight", "Featherweight", "Lightweight", "Welterweight", "Middleweight", "Light Heavyweight",
    "Heavyweight", "Women's Atomweight", "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight", "Women's Featherweight",
    "Women's Lightweight",
]

_cache: dict[str, dict] = {}


def get_org(org_id: str) -> Org:
    try:
        return ORGS[org_id.lower()]
    except KeyError as exc:
        raise KeyError(f"Unknown organisation: {org_id}") from exc


def list_orgs() -> list[Org]:
    return list(ORGS.values())


# --------------------------------------------------------------------------- loading


def _name_key(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def _read_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _text(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _number(value) -> float | None:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _integer(value) -> int | None:
    number = _number(value)
    return None if number is None else int(number)


def _signature(org: Org) -> tuple:
    return tuple(
        (org.data_dir / name).stat().st_mtime_ns if (org.data_dir / name).exists() else None
        for name in ("fights.csv", "fighters.csv", "rankings.csv")
    )


def _data(org_id: str) -> dict:
    """Everything the endpoints need for one organisation, rebuilt when one of its CSV files changes."""
    org = get_org(org_id)
    signature = _signature(org)
    cached = _cache.get(org.id)
    if cached is None or cached["signature"] != signature:
        _cache[org.id] = {"signature": signature, **_build(org)}
    return _cache[org.id]


# --------------------------------------------------------------------------- building


def _format_fight(row: dict) -> dict:
    return {
        "fighter_1": row["fighter_1"],
        "fighter_2": row["fighter_2"],
        "winner": _text(row.get("winner")),
        "weight_class": _text(row.get("weight_class")),
        "stage": _text(row.get("stage")),
        "method": _text(row.get("method")),
        "method_detail": _text(row.get("method_detail")),
        "round": _integer(row.get("round")),
        "time": _text(row.get("time")),
        "fight_url": _text(row.get("fight_url")),
        "title_fight": True if str(row.get("title_fight", "")).lower() == "true" else None,
    }


def _build_events(fight_rows: list[dict]) -> list[dict]:
    by_event: dict[str, list[dict]] = {}
    for row in fight_rows:
        by_event.setdefault(row["event_slug"], []).append(row)

    events = []
    for slug, rows in by_event.items():
        rows.sort(key=lambda row: _integer(row.get("card_order")) or 0)
        first = rows[0]
        events.append(
            {
                "slug": slug,
                "name": first["event_name"],
                "date": _text(first.get("event_date")),
                "location": _text(first.get("location")),
                "circuit": _text(first.get("circuit")),
                "event_url": _text(first.get("event_url")),
                "fight_count": len(rows),
                "fights": [_format_fight(row) for row in rows],
            }
        )
    return events


def _fighter_history(events: list[dict]) -> dict[str, list[dict]]:
    """name key -> every bout of that fighter, newest first."""
    history: dict[str, list[dict]] = {}
    for event in events:
        for fight in event["fights"]:
            for name, opponent in ((fight["fighter_1"], fight["fighter_2"]), (fight["fighter_2"], fight["fighter_1"])):
                result = "win" if fight["winner"] == name else "loss" if fight["winner"] == opponent else None
                method = (fight["method"] or "").upper()
                outcome = result or ("no_contest" if method == "NO CONTEST" else "draw" if method == "DRAW" else None)
                history.setdefault(_name_key(name), []).append(
                    {
                        "event_name": event["name"],
                        "date": event["date"],
                        "opponent": opponent,
                        "result": result,
                        "weight_class": fight["weight_class"],
                        "method": fight["method"],
                        "method_detail": fight["method_detail"],
                        "round": fight["round"],
                        "time": fight["time"],
                        "winner": fight["winner"],
                        "location": event["location"],
                        "fight_url": fight["fight_url"],
                        "title_fight": fight["title_fight"],
                        "outcome": outcome,
                    }
                )
    for fights in history.values():
        fights.sort(key=lambda fight: fight["date"] or "", reverse=True)
    return history


def _build_rankings(rows: list[dict], fighters_by_key: dict[str, dict], last_fight: dict[str, str]) -> list[dict]:
    categories: dict[str, dict] = {}
    for row in rows:
        entry_rank = _integer(row.get("rank")) or 0
        name = (row.get("fighter") or "").strip()
        category = categories.setdefault(
            row["category"], {"category": row["category"], "is_p4p": str(row.get("is_p4p", "")).lower() == "true", "entries": []}
        )
        if not name:  # a vacant title
            continue
        key = _name_key(name)
        fighter = fighters_by_key.get(key)
        category["entries"].append(
            {
                "rank": entry_rank,
                "fighter": name,
                "rank_change": _text(row.get("rank_change")),
                "status": _text(row.get("status")),
                "win_rate": fighter["win_rate"] if fighter else None,
                "last_fight": last_fight.get(key),
                "athlete_url": fighter["profile_url"] if fighter else None,
            }
        )
    for category in categories.values():
        category["entries"].sort(key=lambda entry: (entry["rank"], entry["status"] != "champion"))

    def order(category: dict) -> tuple:
        label = category["category"]
        if label in DIVISION_ORDER:
            return (not category["is_p4p"], DIVISION_ORDER.index(label), label)
        return (not category["is_p4p"], len(DIVISION_ORDER), label)

    return sorted(categories.values(), key=order)


def _record_from_fights(fights: list[dict], today: str) -> str | None:
    """'W-L-D' of the bouts already fought, or None when there are none."""
    fought = [fight for fight in fights if fight["outcome"] and (fight["date"] or "") < today]
    if not fought:
        return None
    wins = sum(fight["outcome"] == "win" for fight in fought)
    losses = sum(fight["outcome"] == "loss" for fight in fought)
    return f"{wins}-{losses}-{sum(fight['outcome'] == 'draw' for fight in fought)}"


def _build_fighters(
    rows: list[dict],
    history: dict[str, list[dict]],
    rankings: list[dict],
    upcoming: dict[str, dict],
    today: str,
) -> list[dict]:
    """One entry per person: when a person has two profile pages, the one with the latest fight wins."""
    chosen: dict[str, dict] = {}
    for row in rows:
        key = _name_key(row.get("name"))
        current = chosen.get(key)
        if current is None or (row.get("last_fight_date") or "") > (current.get("last_fight_date") or ""):
            chosen[key] = row

    # A division place or title tells more than a pound-for-pound place, which is only used when there is nothing else.
    titles: dict[str, str] = {}
    positions: dict[str, str] = {}
    for category in sorted(rankings, key=lambda item: item["is_p4p"]):
        for entry in category["entries"]:
            key = _name_key(entry["fighter"])
            if entry["rank"] == 0 and not category["is_p4p"]:
                titles[key] = entry["status"] or "champion"
                positions.setdefault(key, f"{'Interim ' if entry['status'] == 'interim' else ''}Champion · {category['category']}")
            elif entry["rank"] > 0:
                positions.setdefault(key, f"#{entry['rank']} {category['category'].replace('Pound-for-Pound', 'P4P')}")

    fighters = []
    for key, row in chosen.items():
        wins, losses, draws = _integer(row.get("wins")), _integer(row.get("losses")), _integer(row.get("draws"))
        no_contests = _integer(row.get("no_contests"))
        fights = history.get(key, [])
        decided = (wins or 0) + (losses or 0) + (draws or 0)
        # Without a record of its own in the CSV, the organization's record is counted from the bouts we have.
        org_record = _text(row.get("org_record")) or _record_from_fights(fights, today)
        division = _text(row.get("weight_class")) or next((fight["weight_class"] for fight in fights if fight["weight_class"]), None)
        fighters.append(
            {
                "name": row["name"],
                "nickname": _text(row.get("nickname")),
                "is_active": row.get("status") == "active",
                "age": _number(row.get("age")),
                "height_cm": _number(row.get("height_cm")),
                "weight_lbs": _number(row.get("weight_lbs")),
                "reach_cm": _number(row.get("reach_cm")),
                "leg_reach_cm": _number(row.get("leg_reach_cm")),
                "wins": wins,
                "losses": losses,
                "draws": draws,
                "no_contests": no_contests,
                "total_fights": decided + (no_contests or 0) if wins is not None else None,
                "win_rate": round(wins / decided, 4) if wins is not None and decided else None,
                "division": division,
                "belt": titles.get(key) in ("champion", "interim"),
                "title_status": titles.get(key),
                "ranking": positions.get(key),
                "image_url": _text(row.get("image_url")),
                "profile_url": _text(row.get("profile_url")),
                "hometown": _text(row.get("hometown")),
                "country": _text(row.get("country")),
                "country_code": _text(row.get("country_code")),
                "camp": _text(row.get("camp")),
                "fighting_out_of": _text(row.get("fighting_out_of")),
                "circuit": _text(row.get("circuit")),
                "org_record": org_record,
                "org_fights": len(fights),
                "first_fight_date": _text(row.get("first_fight_date")),
                "last_fight_date": _text(row.get("last_fight_date")),
                "next_fight": upcoming.get(key),
            }
        )
    fighters.sort(key=lambda fighter: (not fighter["is_active"], _name_key(fighter["name"])))
    return fighters


def _build(org: Org) -> dict:
    fight_rows = _read_rows(org.data_dir / "fights.csv")
    events = _build_events(fight_rows)
    today = date.today().isoformat()

    past = sorted((event for event in events if (event["date"] or "") < today), key=lambda event: event["date"] or "", reverse=True)
    upcoming = sorted((event for event in events if (event["date"] or "") >= today), key=lambda event: event["date"] or "9999")

    history = _fighter_history(events)
    # A fighter's last fight is the last one that happened, not the one booked for next month.
    last_fight = {}
    for key, fights in history.items():
        fought = [fight["date"] for fight in fights if fight["date"] and fight["date"] < today]
        if fought:
            last_fight[key] = fought[0]

    next_fight: dict[str, dict] = {}
    for event in upcoming:
        for fight in event["fights"]:
            if fight["winner"] or fight["method"]:  # already fought (a card in progress today)
                continue
            for name, opponent in ((fight["fighter_1"], fight["fighter_2"]), (fight["fighter_2"], fight["fighter_1"])):
                next_fight.setdefault(_name_key(name), {"event": event["name"], "date": event["date"], "opponent": opponent})

    ranking_rows = _read_rows(org.data_dir / "rankings.csv")
    fighter_rows = _read_rows(org.data_dir / "fighters.csv")

    # Rankings need the win rates, the fighters need the titles: build the fighters twice, the first time without titles.
    provisional = _build_fighters(fighter_rows, history, [], next_fight, today)
    provisional_by_key = {_name_key(fighter["name"]): fighter for fighter in provisional}
    rankings = _build_rankings(ranking_rows, provisional_by_key, last_fight)
    fighters = _build_fighters(fighter_rows, history, rankings, next_fight, today)

    checked = sorted(row.get("checked") or "" for row in fighter_rows)
    return {
        "events": past,
        "upcoming": upcoming,
        "history": history,
        "fighters": fighters,
        "rankings": rankings,
        "last_updated": checked[-1] if checked and checked[-1] else None,
        "fights_count": sum(event["fight_count"] for event in past),
    }


# --------------------------------------------------------------------------- public API


def get_org_fighters(org_id: str) -> list[dict]:
    return _data(org_id)["fighters"]


def get_org_events(org_id: str) -> list[dict]:
    """Past events, newest first."""
    return _data(org_id)["events"]


def get_org_upcoming_events(org_id: str) -> list[dict]:
    """Today's and future events, soonest first."""
    return _data(org_id)["upcoming"]


def get_org_rankings(org_id: str) -> list[dict]:
    return _data(org_id)["rankings"]


def get_org_fighter_fights(org_id: str, name: str) -> list[dict]:
    """Every bout of one fighter, newest first (upcoming ones included). Raises KeyError for an unknown name."""
    data = _data(org_id)
    key = _name_key(name)
    if not any(_name_key(fighter["name"]) == key for fighter in data["fighters"]):
        raise KeyError(f"Fighter not found: {name}")
    return data["history"].get(key, [])


def get_org_data_info(org_id: str) -> dict:
    org = get_org(org_id)
    data = _data(org_id)
    return {
        "last_updated": data["last_updated"],
        "fighters_count": len(data["fighters"]),
        "events_count": len(data["events"]),
        "fights_count": data["fights_count"],
        "sources": list(org.sources),
    }
