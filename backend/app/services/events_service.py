from __future__ import annotations

import math

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

from .bmf_service import BMF_FIGHTS_SOURCE_PATH, is_bmf_title_fight
from .catalog_service import NAME_ALIASES_PATH, canonical_name

EVENT_CARDS_SOURCE_PATH = RAW_DATA_DIR / "event_cards.csv"
UPCOMING_EVENTS_SOURCE_PATH = RAW_DATA_DIR / "upcoming_events.csv"
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
    return _upcoming_cache["data"]


def _format_fight(row: pd.Series, champions: dict[str, set[str]] | None = None) -> dict:
    title_fight = _to_bool(row.get("title_fight"))
    if title_fight is None and champions:
        # Upcoming cards carry no title flag: a fight is a title defense when today's champion of that division is in it.
        holders = champions.get(_nullable_string(row.get("weight_class")) or "", set())
        if holders & {str(canonical_name(row["fighter_1"])), str(canonical_name(row["fighter_2"]))}:
            title_fight = True
    fighter_1, fighter_2 = canonical_name(row["fighter_1"]), canonical_name(row["fighter_2"])
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
        "bmf_title": is_bmf_title_fight(_nullable_string(row.get("fight_url"))),
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
