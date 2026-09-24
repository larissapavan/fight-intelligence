from __future__ import annotations

import logging
import math
import re

import pandas as pd

logger = logging.getLogger(__name__)

from src.ufc_predictor.config import RAW_DATA_DIR


FIGHTERS_SOURCE_PATH = RAW_DATA_DIR / "fighters.csv"
FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "fights.csv"
CAREER_STATS_SOURCE_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"

VALID_STANCES = {"Orthodox", "Southpaw", "Switch", "Open Stance", "Unknown"}


def _build_catalog() -> pd.DataFrame:
    if not FIGHTERS_SOURCE_PATH.exists():
        raise FileNotFoundError(f"Fighter source dataset not found at {FIGHTERS_SOURCE_PATH}")

    fighters_df = pd.read_csv(FIGHTERS_SOURCE_PATH).fillna("")
    fighters_df["name"] = (
        fighters_df["first_name"].astype(str).str.strip() + " " + fighters_df["last_name"].astype(str).str.strip()
    ).str.strip()
    fighters_df = fighters_df[fighters_df["name"].ne("")].copy()
    fighters_df["profile_key"] = fighters_df["name"].apply(_normalize_name)

    fighters_df["nickname"] = fighters_df["nickname"].astype(str).str.strip().replace("", pd.NA)
    fighters_df["height_cm"] = fighters_df["height"].apply(_parse_height_to_cm)
    fighters_df["weight_lbs"] = fighters_df["weight"].apply(_parse_number)
    fighters_df["reach_cm"] = fighters_df["reach"].apply(_parse_reach_to_cm)
    fighters_df["wins"] = pd.to_numeric(fighters_df["wins"], errors="coerce").fillna(0).round().astype(int)
    fighters_df["losses"] = pd.to_numeric(fighters_df["losses"], errors="coerce").fillna(0).round().astype(int)
    fighters_df["draws"] = pd.to_numeric(fighters_df["draws"], errors="coerce").fillna(0).round().astype(int)
    fighters_df["stance"] = fighters_df["stance"].astype(str).str.strip().apply(normalize_stance)
    fighters_df["belt"] = fighters_df["belt"].astype(str).str.strip().str.lower().isin(
        {"yes", "true", "1", "belt", "champion"}
    )
    fighters_df["fighter_url"] = fighters_df["fighter_url"].astype(str).str.strip().replace("", pd.NA)

    career_stats = _load_career_stats()
    fighters_df = fighters_df.merge(career_stats, on="fighter_url", how="left", suffixes=("", "_live"))
    for column in ("wins", "losses", "draws"):
        fighters_df[column] = (
            fighters_df[f"{column}_live"].combine_first(fighters_df[column]).fillna(0).round().astype(int)
        )
        fighters_df = fighters_df.drop(columns=[f"{column}_live"])

    fight_summary = _load_fight_summary()
    catalog = fighters_df.merge(fight_summary, on="profile_key", how="left")
    catalog["division"] = catalog["division"].combine_first(catalog["weight_lbs"].apply(_division_from_weight))
    catalog["total_fights"] = catalog["tracked_bouts"].combine_first(
        catalog["wins"] + catalog["losses"] + catalog["draws"]
    )
    catalog["total_fights"] = catalog["total_fights"].fillna(0).round().astype(int)
    catalog["win_rate"] = catalog["wins"] / (catalog["wins"] + catalog["losses"] + catalog["draws"] + 1)
    catalog["rank_signal"] = catalog["belt"].map(lambda value: "Champion" if value else "Contender")

    catalog["ranking"] = pd.NA
    catalog["image_url"] = pd.NA

    return catalog.sort_values("name").drop_duplicates(subset=["profile_key"], keep="last").reset_index(drop=True)


CAREER_STATS_COLUMNS = ["fighter_url", "age", "sig_str_acc", "takedown_acc", "wins", "losses", "draws"]


def _load_career_stats() -> pd.DataFrame:
    empty = pd.DataFrame(columns=CAREER_STATS_COLUMNS)
    if not CAREER_STATS_SOURCE_PATH.exists():
        return empty

    stats_df = pd.read_csv(CAREER_STATS_SOURCE_PATH)
    stats_df["fighter_url"] = stats_df["fighter_url"].astype(str).str.strip()
    stats_df["age"] = stats_df["dob"].apply(_age_from_dob)
    stats_df["sig_str_acc"] = stats_df["sig_str_acc"].apply(_parse_percent)
    stats_df["takedown_acc"] = stats_df["takedown_acc"].apply(_parse_percent)
    for column in ("wins", "losses", "draws"):
        stats_df[column] = (
            pd.to_numeric(stats_df[column], errors="coerce") if column in stats_df.columns else float("nan")
        )
    return stats_df[CAREER_STATS_COLUMNS]


def _age_from_dob(value) -> float | None:
    text = str(value).strip() if pd.notna(value) else ""
    if not text or text == "--":
        return None
    dob = pd.to_datetime(text, format="%b %d, %Y", errors="coerce")
    if pd.isna(dob):
        return None
    age_days = (pd.Timestamp.today().normalize() - dob).days
    return round(age_days / 365.25, 2)


def _parse_percent(value) -> float | None:
    text = str(value).strip() if pd.notna(value) else ""
    if not text or text == "--":
        return None
    number = _parse_number(text)
    return round(number / 100.0, 4) if number is not None else None


def _load_fight_summary() -> pd.DataFrame:
    empty = pd.DataFrame(columns=["profile_key", "division", "tracked_bouts"])
    if not FIGHTS_SOURCE_PATH.exists():
        return empty

    fights_df = pd.read_csv(FIGHTS_SOURCE_PATH, usecols=["event_date", "fighter_1", "fighter_2", "weight_class"])
    if fights_df.empty:
        return empty

    first_view = fights_df[["event_date", "fighter_1", "weight_class"]].rename(columns={"fighter_1": "name"})
    second_view = fights_df[["event_date", "fighter_2", "weight_class"]].rename(columns={"fighter_2": "name"})
    history = pd.concat([first_view, second_view], ignore_index=True)
    history = history.dropna(subset=["name"]).copy()
    history["profile_key"] = history["name"].apply(_normalize_name)
    history["event_date"] = pd.to_datetime(history["event_date"], errors="coerce")
    history["division"] = history["weight_class"].apply(_format_division)

    bouts = history.groupby("profile_key").size().rename("tracked_bouts").reset_index()
    latest_division = (
        history.dropna(subset=["event_date"])
        .sort_values("event_date")
        .groupby("profile_key", as_index=False)
        .tail(1)[["profile_key", "division"]]
    )

    return bouts.merge(latest_division, on="profile_key", how="left")


_catalog_cache: dict = {"signature": None, "data": None}


def _source_signature() -> tuple:
    paths = [FIGHTERS_SOURCE_PATH, FIGHTS_SOURCE_PATH, CAREER_STATS_SOURCE_PATH]
    return tuple(path.stat().st_mtime_ns if path.exists() else None for path in paths)


def get_fighter_catalog() -> pd.DataFrame:
    """Build the fighter catalog, rebuilding automatically when a source CSV changes.

    The career-stats scraper appends to fighter_career_stats.csv while this
    service is running, so a static in-process cache would keep serving
    stale (missing) data until the process restarted.
    """

    signature = _source_signature()
    if _catalog_cache["signature"] != signature:
        rebuilding = _catalog_cache["signature"] is not None
        _catalog_cache["data"] = _build_catalog()
        _catalog_cache["signature"] = signature
        if rebuilding:
            logger.info("Fighter catalog rebuilt: source CSVs changed (%d fighters).", len(_catalog_cache["data"]))
    return _catalog_cache["data"]


def get_total_fights_tracked() -> int:
    if not FIGHTS_SOURCE_PATH.exists():
        return 0
    fights_df = pd.read_csv(FIGHTS_SOURCE_PATH, usecols=["fight_url"])
    return int(fights_df["fight_url"].dropna().nunique())


def list_fighters() -> list[dict]:
    catalog = get_fighter_catalog().copy()
    return [_format_profile(row) for row in catalog.to_dict(orient="records")]


def get_fighter_profile(name: str) -> dict:
    catalog = get_fighter_catalog()
    match = catalog.loc[catalog["name"] == name]
    if match.empty:
        raise KeyError(f"Fighter '{name}' was not found in the catalog.")

    return _format_profile(match.iloc[0].to_dict())


def _format_profile(record: dict) -> dict:
    return {
        "name": record["name"],
        "nickname": _nullable_string(record.get("nickname")),
        "age": _to_float(record.get("age")),
        "height_cm": _to_float(record.get("height_cm")),
        "weight_lbs": _to_float(record.get("weight_lbs")),
        "reach_cm": _to_float(record.get("reach_cm")),
        "wins": int(record["wins"]) if pd.notna(record.get("wins")) else 0,
        "losses": int(record["losses"]) if pd.notna(record.get("losses")) else 0,
        "draws": int(record["draws"]) if pd.notna(record.get("draws")) else 0,
        "total_fights": int(record["total_fights"]) if pd.notna(record.get("total_fights")) else 0,
        "win_rate": _to_float(record.get("win_rate")),
        "sig_str_acc": _to_float(record.get("sig_str_acc")),
        "takedown_acc": _to_float(record.get("takedown_acc")),
        "stance": record.get("stance") or "Unknown",
        "division": _nullable_string(record.get("division")),
        "belt": bool(record.get("belt", False)),
        "ranking": _nullable_string(record.get("ranking")),
        "rank_signal": _nullable_string(record.get("rank_signal")),
        "image_url": _nullable_string(record.get("image_url")),
        "fighter_url": _nullable_string(record.get("fighter_url")),
    }


def _nullable_string(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _to_float(value) -> float | None:
    if value is None or pd.isna(value):
        return None
    number = float(value)
    if math.isnan(number):
        return None
    return number


def _normalize_name(value: str) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()
    return re.sub(r"\s+", " ", normalized)


def _parse_number(value: str) -> float | None:
    if not value:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", str(value))
    if not match:
        return None
    return float(match.group(1))


def _parse_height_to_cm(value: str) -> float | None:
    if not value or str(value).strip() == "--":
        return None
    match = re.search(r"(\d+)'\s*(\d+)", str(value))
    if not match:
        return None
    feet = int(match.group(1))
    inches = int(match.group(2))
    return round(((feet * 12) + inches) * 2.54, 2)


def _parse_reach_to_cm(value: str) -> float | None:
    number = _parse_number(value)
    if number is None:
        return None
    return round(number * 2.54, 2)


def normalize_stance(value: str) -> str:
    if value in VALID_STANCES:
        return value
    return "Unknown"


def _format_division(value: str) -> str | None:
    if not value or pd.isna(value):
        return None
    text = re.sub(r"\s+", " ", str(value).strip())
    if not text:
        return None
    text = text.replace("women's", "Women's")
    return text.title().replace("Women'S", "Women's")


def _division_from_weight(weight_lbs: float | None) -> str | None:
    if weight_lbs is None or pd.isna(weight_lbs):
        return None
    if weight_lbs <= 115:
        return "Strawweight"
    if weight_lbs <= 125:
        return "Flyweight"
    if weight_lbs <= 135:
        return "Bantamweight"
    if weight_lbs <= 145:
        return "Featherweight"
    if weight_lbs <= 155:
        return "Lightweight"
    if weight_lbs <= 170:
        return "Welterweight"
    if weight_lbs <= 185:
        return "Middleweight"
    if weight_lbs <= 205:
        return "Light Heavyweight"
    return "Heavyweight"
