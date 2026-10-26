from __future__ import annotations

import math
import re
import unicodedata
from datetime import date

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

from .bmf_service import BMF_FIGHTS_SOURCE_PATH, is_announced_bmf_bout, is_bmf_title_fight
from .catalog_service import NAME_ALIASES_PATH, canonical_name

EVENT_CARDS_SOURCE_PATH = RAW_DATA_DIR / "event_cards.csv"
UPCOMING_EVENTS_SOURCE_PATH = RAW_DATA_DIR / "upcoming_events.csv"
MANUAL_FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "manual_fights.csv"
FIGHT_DETAILS_SOURCE_PATH = RAW_DATA_DIR / "fight_details.csv"
DETAIL_COLUMNS = ["referee", "num_rounds", "title_fight", "result", "result_details"]


def _load_event_cards(source_path) -> pd.DataFrame:
    if not source_path.exists():
        return pd.DataFrame(columns=["event_name", "event_date", "location", "event_url"])

    df = pd.read_csv(source_path)
    df = _attach_fight_details(df)
    df["event_date_parsed"] = pd.to_datetime(df["event_date"], format="%B %d, %Y", errors="coerce")
    return df


def _attach_fight_details(df: pd.DataFrame) -> pd.DataFrame:
    """Add referee, scheduled rounds, title-fight flag and result details, matched by fight_url."""
    if "fight_url" not in df.columns or not FIGHT_DETAILS_SOURCE_PATH.exists():
        return df
    details = pd.read_csv(FIGHT_DETAILS_SOURCE_PATH, keep_default_na=False)
    details = details.drop_duplicates(subset=["fight_url"], keep="last")[["fight_url", *DETAIL_COLUMNS]]
    return df.merge(details, on="fight_url", how="left")


_events_cache: dict = {"signature": None, "data": None}
_upcoming_cache: dict = {"signature": None, "data": None}


def _source_signature(source_path) -> tuple | None:
    if not source_path.exists():
        return None
    details = FIGHT_DETAILS_SOURCE_PATH.stat().st_mtime_ns if FIGHT_DETAILS_SOURCE_PATH.exists() else None
    bmf = BMF_FIGHTS_SOURCE_PATH.stat().st_mtime_ns if BMF_FIGHTS_SOURCE_PATH.exists() else None
    aliases = NAME_ALIASES_PATH.stat().st_mtime_ns if NAME_ALIASES_PATH.exists() else None
    return (source_path.stat().st_mtime_ns, details, bmf, aliases)


def _current_champions() -> dict[str, set[str]]:
    """division -> names of today's undisputed champions (title_reigns.csv)."""
    from .champions_service import _load_reigns_df

    reigns = _load_reigns_df()
    if reigns.empty:
        return {}
    current = reigns[reigns["is_current"] & reigns["title_type"].eq("undisputed")]
    champions: dict[str, set[str]] = {}
    for _, row in current.iterrows():
        champions.setdefault(str(row["division"]), set()).add(str(row["champion"]))
    return champions


def _build_events(source_path, *, ascending: bool, infer_title_fights: bool = False) -> list[dict]:
    df = _load_event_cards(source_path)
    if df.empty:
        return []
    champions = _current_champions() if infer_title_fights else {}

    # Events added without a ufcstats URL (announced cards taken from other sources) are grouped by name.
    df["_group_key"] = df["event_url"].fillna(df["event_name"])

    events: list[dict] = []
    for _, group in df.groupby("_group_key", sort=False):
        first = group.iloc[0]
        date_parsed = first["event_date_parsed"]
        events.append(
            {
                "name": first["event_name"],
                "date": date_parsed.date().isoformat() if pd.notna(date_parsed) else None,
                "_sort_date": date_parsed if pd.notna(date_parsed) else pd.Timestamp.min,
                "location": _nullable_string(first.get("location")),
                "fight_count": int(group["fighter_1"].notna().sum()),
                "fights": [
                    _format_fight(row, champions) for _, row in group.iterrows() if pd.notna(row.get("fighter_1"))
                ],
                "event_url": _nullable_string(first.get("event_url")),
            }
        )

    events.sort(key=lambda event: event["_sort_date"], reverse=not ascending)
    for event in events:
        del event["_sort_date"]
    return events


def get_events() -> list[dict]:
    """Return every past event with its full fight card, most recent first.

    Rebuilds automatically when data/raw/event_cards.csv changes (the
    scraper appends to it while this service may already be running), same
    pattern as catalog_service.get_fighter_catalog().
    """

    signature = _source_signature(EVENT_CARDS_SOURCE_PATH)
    if _events_cache["signature"] != signature:
        _events_cache["data"] = _build_events(EVENT_CARDS_SOURCE_PATH, ascending=False)
        _events_cache["signature"] = signature
    return _events_cache["data"]


def get_upcoming_events() -> list[dict]:
    """Return scheduled-but-not-yet-fought events, soonest first.

    Every fight in these events has winner=None since they haven't happened
    yet; fight cards can also be partially announced (main event locked in,
    undercard still filling out), matching ufcstats.com itself.
    """

    signature = _source_signature(UPCOMING_EVENTS_SOURCE_PATH)
    if _upcoming_cache["signature"] != signature:
        _upcoming_cache["data"] = _build_events(UPCOMING_EVENTS_SOURCE_PATH, ascending=True, infer_title_fights=True)
        _upcoming_cache["signature"] = signature
    merged = _merge_manual_fights(_upcoming_cache["data"], _load_manual_fights(), date.today().isoformat())
    return [_main_event_first(event) for event in merged]


_upcoming_bouts_cache: dict = {"signature": None, "by_fighter": {}}


def get_upcoming_bouts_by_fighter() -> dict[str, list[dict]]:
    """Return map of normalized fighter name -> list of announced upcoming bouts."""
    signature = _source_signature(UPCOMING_EVENTS_SOURCE_PATH)
    manual_sig = MANUAL_FIGHTS_SOURCE_PATH.stat().st_mtime_ns if MANUAL_FIGHTS_SOURCE_PATH.exists() else None
    cache_key = (signature, manual_sig)

    if _upcoming_bouts_cache["signature"] != cache_key:
        from .catalog_service import _normalize_name
        events = get_upcoming_events()
        by_fighter: dict[str, list[dict]] = {}
        for event in events:
            fights = event.get("fights", [])
            for idx, fight in enumerate(fights):
                f1 = canonical_name(fight.get("fighter_1"))
                f2 = canonical_name(fight.get("fighter_2"))
                if not f1 or not f2:
                    continue
                is_main = (idx == 0)
                bout_common = {
                    "event_name": event["name"],
                    "event_date": event["date"],
                    "location": event.get("location"),
                    "weight_class": fight.get("weight_class"),
                    "title_fight": bool(fight.get("title_fight")),
                    "interim_title": bool(fight.get("interim_title")),
                    "bmf_title": bool(fight.get("bmf_title")),
                    "is_main_event": is_main,
                    "event_url": event.get("event_url"),
                }
                for ftr, opp in ((f1, f2), (f2, f1)):
                    key = _normalize_name(ftr)
                    by_fighter.setdefault(key, []).append({
                        **bout_common,
                        "opponent": opp,
                    })
        _upcoming_bouts_cache["by_fighter"] = by_fighter
        _upcoming_bouts_cache["signature"] = cache_key
    return _upcoming_bouts_cache["by_fighter"]


def get_fighter_upcoming_bouts(name: str) -> list[dict]:
    bouts = get_upcoming_bouts_by_fighter()
    c_name = canonical_name(name) or name
    from .catalog_service import _normalize_name
    return bouts.get(_normalize_name(c_name), [])


def _surname_tokens(text: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return [part for part in re.split(r"[^a-z0-9]+", plain) if part]


def _main_event_first(event: dict) -> dict:
    """Put the main event first and the rest in card order, the way the pages show a card.

    Upcoming cards come from ESPN, which lists bouts from the first prelim to the main event. The main event is the
    bout the card is named after ("UFC 333: Volkanovski vs. Evloev"); when no bout matches the name, the last one is it."""
    fights = event["fights"]
    if len(fights) < 2:
        return event
    headliners = [_surname_tokens(side) for side in re.split(r"\s+vs\.?\s+", event["name"].split(":", 1)[-1], flags=re.IGNORECASE)]
    main = len(fights) - 1
    if len(headliners) == 2 and all(headliners):
        for index, fight in enumerate(fights):
            names = [set(_surname_tokens(str(fight["fighter_1"]))), set(_surname_tokens(str(fight["fighter_2"])))]
            if any(all(token in names[0] for token in a) and all(token in names[1] for token in b) for a, b in (headliners, headliners[::-1])):
                main = index
                break
    ordered = [fights[main]] + [fight for index, fight in enumerate(reversed(fights)) if len(fights) - 1 - index != main]
    return {**event, "fights": ordered}


def _load_manual_fights() -> list[dict]:
    if not MANUAL_FIGHTS_SOURCE_PATH.exists():
        return []
    frame = pd.read_csv(MANUAL_FIGHTS_SOURCE_PATH, keep_default_na=False, dtype=str)
    return frame.to_dict(orient="records")


def _pair_key(fighter_1: str, fighter_2: str) -> tuple[str, str]:
    first, second = sorted([str(canonical_name(fighter_1)).lower(), str(canonical_name(fighter_2)).lower()])
    return first, second


def _merge_manual_fights(events: list[dict], manual: list[dict], today: str) -> list[dict]:
    """Add fights announced in the news before ESPN lists them (data/raw/manual_fights.csv).

    The daily ESPN refresh rebuilds upcoming_events.csv and drops cards it does not know, so a hand-added fight cannot
    live there. Here it is layered on top instead, and retires itself: once ESPN lists the same pairing, or the date has
    passed, the manual row is ignored."""
    if not manual:
        return events
    merged = [{**event, "fights": list(event["fights"])} for event in events]
    announced = {_pair_key(fight["fighter_1"], fight["fighter_2"]) for event in merged for fight in event["fights"]}

    for row in manual:
        date_iso = (row.get("event_date") or "").strip()
        fighter_1, fighter_2 = (row.get("fighter_1") or "").strip(), (row.get("fighter_2") or "").strip()
        if not (date_iso and fighter_1 and fighter_2) or date_iso < today or _pair_key(fighter_1, fighter_2) in announced:
            continue
        fight = _format_fight(
            pd.Series(
                {
                    "fighter_1": fighter_1,
                    "fighter_2": fighter_2,
                    "weight_class": (row.get("weight_class") or "").strip() or None,
                    "title_fight": None,
                }
            ),
            _current_champions(),
        )
        event = next((item for item in merged if item["date"] == date_iso and item["name"] == row.get("event_name")), None)
        if event is None:
            event = {
                "name": row.get("event_name") or "Upcoming card",
                "date": date_iso,
                "location": (row.get("location") or "").strip() or None,
                "fight_count": 0,
                "fights": [],
                "event_url": None,
            }
            merged.append(event)
        event["fights"].append(fight)
        event["fight_count"] = len(event["fights"])
        announced.add(_pair_key(fighter_1, fighter_2))

    merged.sort(key=lambda item: item["date"] or "9999")
    return merged


_TITLE_OVERRIDE_PAIRS: dict = {
    _pair_key("Petr Yan", "Merab Dvalishvili"): {"title_fight": True, "interim_title": False},
    _pair_key("Alexander Volkanovski", "Movsar Evloev"): {"title_fight": True, "interim_title": False},
}


def _format_fight(row: pd.Series, champions: dict[str, set[str]] | None = None) -> dict:
    fighter_1, fighter_2 = canonical_name(row["fighter_1"]), canonical_name(row["fighter_2"])
    pair = _pair_key(fighter_1, fighter_2)

    title_fight = _to_bool(row.get("title_fight"))
    interim_title = _to_bool(row.get("interim_title")) or False

    if pair in _TITLE_OVERRIDE_PAIRS:
        override = _TITLE_OVERRIDE_PAIRS[pair]
        if "title_fight" in override:
            title_fight = override["title_fight"]
        if "interim_title" in override:
            interim_title = override["interim_title"]

    if interim_title:
        title_fight = True

    if title_fight is None and champions:
        # Upcoming cards carry no title flag: a fight is a title defense when today's champion of that division is in it.
        holders = champions.get(_nullable_string(row.get("weight_class")) or "", set())
        if holders & {str(fighter_1), str(fighter_2)}:
            title_fight = True

    return {
        "fighter_1": fighter_1,
        "fighter_2": fighter_2,
        "winner": canonical_name(_nullable_string(row.get("winner"))),
        "weight_class": _nullable_string(row.get("weight_class")),
        "method": _nullable_string(row.get("method")),
        "method_detail": _nullable_string(row.get("method_detail")),
        "round": _to_int(row.get("round")),
        "time": _nullable_string(row.get("time")),
        "fight_url": _nullable_string(row.get("fight_url")),
        "referee": _nullable_string(row.get("referee")),
        "num_rounds": _to_int(row.get("num_rounds")),
        "title_fight": title_fight,
        "bmf_title": is_bmf_title_fight(_nullable_string(row.get("fight_url"))) or is_announced_bmf_bout(fighter_1, fighter_2),
        "interim_title": interim_title,
        "result": _nullable_string(row.get("result")),
        "result_details": _nullable_string(row.get("result_details")),
    }


def _nullable_string(value) -> str | None:
    if value is None or (isinstance(value, float) and math.isnan(value)) or pd.isna(value):
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
    text = _nullable_string(value)
    if text is None:
        return None
    return text.lower() == "true"
