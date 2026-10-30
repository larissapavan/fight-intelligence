from __future__ import annotations

import logging
import math
import re
import time
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

from src.ufc_predictor.config import BASE_DIR, RAW_DATA_DIR

from .bmf_service import BMF_FIGHTS_SOURCE_PATH, current_bmf_champion
from .champions_service import TITLE_REIGNS_SOURCE_PATH

FIGHTERS_SOURCE_PATH = RAW_DATA_DIR / "fighters.csv"
FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "fights.csv"
CAREER_STATS_SOURCE_PATH = RAW_DATA_DIR / "fighter_career_stats.csv"
HISTORICAL_PHOTOS_SOURCE_PATH = BASE_DIR / "lutadores_historicos.csv"
HISTORICAL_PHOTOS_URL_PREFIX = "/fighter-photos/"
PHOTOS_MANIFEST_PATH = RAW_DATA_DIR / "fighter_photos.csv"
ORIGINS_SOURCE_PATH = RAW_DATA_DIR / "fighter_origins.csv"
HOMETOWN_OVERRIDES_PATH = RAW_DATA_DIR / "hometown_overrides.csv"
NAME_ALIASES_PATH = RAW_DATA_DIR / "name_aliases.csv"
STATUS_OVERRIDES_PATH = RAW_DATA_DIR / "status_overrides.csv"
ROSTER_SOURCE_PATH = RAW_DATA_DIR / "roster_watch.csv"
ORIGIN_COLUMNS = ["hometown", "country", "country_code"]
PHOTO_KIND_PRIORITY = {"espn": 1, "champion": 2}

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

    champion_urls, champion_keys = _current_champion_identifiers()
    fighters_df["belt"] = (
        fighters_df["belt"] | fighters_df["fighter_url"].isin(champion_urls) | fighters_df["profile_key"].isin(champion_keys)
    )

    career_stats = _load_career_stats()
    fighters_df = fighters_df.merge(career_stats, on="fighter_url", how="left", suffixes=("", "_live"))
    for column in ("wins", "losses", "draws"):
        fighters_df[column] = (
            fighters_df[f"{column}_live"].combine_first(fighters_df[column]).fillna(0).round().astype(int)
        )
        fighters_df = fighters_df.drop(columns=[f"{column}_live"])

    fight_summary = _load_fight_summary()
    catalog = fighters_df.merge(fight_summary, on="profile_key", how="left")
    catalog["total_fights"] = catalog["tracked_bouts"].combine_first(
        catalog["wins"] + catalog["losses"] + catalog["draws"]
    )
    catalog["total_fights"] = catalog["total_fights"].fillna(0).round().astype(int)
    catalog["win_rate"] = catalog["wins"] / (catalog["wins"] + catalog["losses"] + catalog["draws"] + 1)
    catalog["rank_signal"] = catalog["belt"].map(lambda value: "Champion" if value else "Contender")

    catalog["ranking"] = pd.NA
    catalog = catalog.merge(_load_roster(), on="fighter_url", how="left")
    # No UFC fight on record (debutants): the division roster.watch lists, with the profile weight to pick between two.
    debut_division = pd.Series(
        [
            _debut_division(classes, weight, gender == "female")
            for classes, weight, gender in zip(catalog["roster_weight_classes"], catalog["weight_lbs"], catalog["roster_gender"])
        ],
        index=catalog.index,
    )
    catalog["division"] = catalog["division"].combine_first(debut_division)
    on_roster = catalog["roster_status"].notna()
    # roster.watch is the authority for who is on the UFC roster; our own signals only cover fighters it does not list.
    catalog["is_active"] = (catalog["roster_status"].eq("active")) | (~on_roster & _flag_active(catalog))
    catalog["ufc_status"] = _ufc_status(catalog, on_roster)
    catalog = _apply_status_overrides(catalog)

    historical_photos = _load_historical_photos()
    catalog = catalog.merge(historical_photos, on="profile_key", how="left")
    catalog["image_url"] = catalog["historical_image_url"]
    catalog = catalog.drop(columns=["historical_image_url"])

    catalog = catalog.merge(_load_origins(), on="fighter_url", how="left")
    # The first nationality roster.watch lists is the country the fighter represents (it drives the main flag).
    primary_code = catalog["roster_country_codes"].fillna("").str.split("|").str[0]
    primary_name = catalog["roster_countries"].fillna("").str.split("|").str[0]
    catalog["country_code"] = primary_code.where(primary_code.ne(""), catalog.get("country_code"))
    catalog["country"] = primary_name.where(primary_name.ne(""), catalog.get("country"))
    catalog = _merge_aliases(catalog)
    catalog["badges"] = _with_current_bmf(catalog)

    # Two fighters can share a name: keep the one roster.watch lists (active first), so its flags and badges show.
    catalog["_priority"] = catalog["is_active"].astype(int) + catalog["roster_status"].notna().astype(int)
    catalog = catalog.sort_values(["name", "_priority"]).drop_duplicates(subset=["profile_key"], keep="last")
    return catalog.drop(columns=["_priority"]).reset_index(drop=True)


ACTIVE_WINDOW_DAYS = 730


def _names_in_csv(path, columns: list[str]) -> set[str]:
    if not path.exists():
        return set()
    frame = pd.read_csv(path, usecols=lambda column: column in columns, keep_default_na=False)
    return {_normalize_name(str(name)) for column in frame.columns for name in frame[column] if str(name).strip()}


_aliases_cache: dict = {"signature": None, "data": {}, "checked": 0.0}


def _apply_status_overrides(catalog: pd.DataFrame) -> pd.DataFrame:
    """Hand-kept status (data/raw/status_overrides.csv: name, status active|former) for news roster.watch has not caught up with.

    A fighter released or retired today is still "active" on roster.watch for a while; delete the row once it agrees."""
    if not STATUS_OVERRIDES_PATH.exists():
        return catalog
    overrides = pd.read_csv(STATUS_OVERRIDES_PATH, keep_default_na=False)
    status_by_name = {_normalize_name(row.name): str(row.status).strip().lower() for row in overrides.itertuples()}
    keys = catalog["name"].map(_normalize_name)
    for key, status in status_by_name.items():
        if status not in {"active", "former"}:
            continue
        rows = keys == key
        catalog.loc[rows, "is_active"] = status == "active"
        catalog.loc[rows, "ufc_status"] = status
    return catalog


def load_name_aliases() -> dict[str, str]:
    """Other spellings of a fighter's name (data/raw/name_aliases.csv): normalized alias -> catalog name.

    ESPN and UFCStats do not always spell a name the same way ("Wes Schultz" / "Wesley Schultz"), and some fighters are
    announced by their nickname. The catalog uses the UFCStats spelling everywhere."""
    # Called for every fight of every event: look at the file at most once a second, and read it only when it changes.
    now = time.monotonic()
    if _aliases_cache["signature"] is not None and now - _aliases_cache["checked"] < 1.0:
        return _aliases_cache["data"]
    if not NAME_ALIASES_PATH.exists():
        return {}
    _aliases_cache["checked"] = now
    signature = NAME_ALIASES_PATH.stat().st_mtime_ns
    if _aliases_cache["signature"] != signature:
        aliases = pd.read_csv(NAME_ALIASES_PATH, keep_default_na=False)
        _aliases_cache["data"] = {
            _normalize_name(row.alias): str(row.canonical).strip()
            for row in aliases.itertuples()
            if str(row.alias).strip() and str(row.canonical).strip()
        }
        _aliases_cache["signature"] = signature
    return _aliases_cache["data"]


def canonical_name(name: str | None) -> str | None:
    """The catalog spelling of a name: itself unless it is a known alias."""
    if not name:
        return name
    return load_name_aliases().get(_normalize_name(name), name)


def _merge_aliases(catalog: pd.DataFrame) -> pd.DataFrame:
    """Fold a duplicate row (an alias) into the real fighter: the real row keeps its values, and borrows what it lacks."""
    aliases = load_name_aliases()
    if not aliases:
        return catalog
    keys = catalog["name"].map(_normalize_name)
    drop: list[int] = []
    for alias_key, canonical in aliases.items():
        alias_rows = catalog.index[keys == alias_key]
        real_rows = catalog.index[keys == _normalize_name(canonical)]
        if len(alias_rows) == 0 or len(real_rows) == 0:
            continue
        alias_row, real_row = alias_rows[0], real_rows[0]
        for column in catalog.columns:
            if column in {"name", "profile_key", "fighter_url", "nickname"}:
                continue
            value = catalog.at[real_row, column]
            missing = (isinstance(value, float) and pd.isna(value)) or value is None or value is pd.NA or (isinstance(value, str) and not value.strip())
            if missing:
                catalog.at[real_row, column] = catalog.at[alias_row, column]
        drop.append(alias_row)
    return catalog.drop(index=drop) if drop else catalog


def _load_roster() -> pd.DataFrame:
    """roster.watch rows linked to our fighters: roster status, UFC debut and last fight, nationalities and badges."""
    columns = ["fighter_url", "roster_status", "ufc_debut", "ufc_last_fight", "roster_url", "roster_countries", "roster_country_codes", "badges", "roster_weight_classes", "roster_gender"]
    if not ROSTER_SOURCE_PATH.exists():
        return pd.DataFrame(columns=columns)
    roster = pd.read_csv(ROSTER_SOURCE_PATH, keep_default_na=False)
    roster = roster[roster["fighter_url"].astype(str).str.strip().ne("")]
    roster = roster.rename(
        columns={
            "status": "roster_status",
            "debut": "ufc_debut",
            "last_fight": "ufc_last_fight",
            "profile": "roster_url",
            "countries": "roster_countries",
            "country_codes": "roster_country_codes",
            "weight_classes": "roster_weight_classes",
            "gender": "roster_gender",
        }
    )
    return roster.drop_duplicates(subset=["fighter_url"], keep="last")[columns]


def _ufc_status(catalog: pd.DataFrame, on_roster: pd.Series) -> pd.Series:
    """active / former (fought in the UFC, no longer on the roster) / never (no UFC fight on record)."""
    fought = catalog["tracked_bouts"].fillna(0).gt(0) | on_roster
    status = pd.Series("never", index=catalog.index)
    status[fought] = "former"
    status[catalog["is_active"]] = "active"
    return status


def _flag_active(catalog: pd.DataFrame) -> pd.Series:
    """Fallback for fighters roster.watch does not list: fought within the last two years of the dataset, is booked
    on an upcoming card, or is currently ranked/champion."""
    last_fight = pd.to_datetime(catalog.get("last_fight_date"), errors="coerce")
    latest = last_fight.max()
    recent = last_fight >= (latest - pd.Timedelta(days=ACTIVE_WINDOW_DAYS)) if pd.notna(latest) else last_fight.notna() & False
    booked = _names_in_csv(RAW_DATA_DIR / "upcoming_events.csv", ["fighter_1", "fighter_2"])
    ranked = _names_in_csv(RAW_DATA_DIR / "rankings.csv", ["fighter"])
    return recent.fillna(False) | catalog["profile_key"].isin(booked | ranked) | catalog["belt"]


def _current_champion_identifiers() -> tuple[set[str], set[str]]:
    """fighter_url / profile_key of today's undisputed champions (title_reigns.csv is the source of truth;
    fighters.csv has no usable belt column). Interim titles don't count as 'the champion'."""
    from .champions_service import _load_reigns_df

    reigns = _load_reigns_df()
    if reigns.empty:
        return set(), set()
    current = reigns[reigns["is_current"] & reigns["title_type"].eq("undisputed")]
    urls = {str(url).strip() for url in current["fighter_url"].dropna() if str(url).strip()}
    keys = {_normalize_name(name) for name in current["champion"].dropna()}
    return urls, keys


CAREER_STATS_COLUMNS = [
    "fighter_url",
    "age",
    "sig_str_acc",
    "takedown_acc",
    "slpm",
    "sapm",
    "str_def",
    "td_avg",
    "td_def",
    "sub_avg",
    "wins",
    "losses",
    "draws",
]


def _load_historical_photos() -> pd.DataFrame:
    """Local fighter photos: the historical set, ESPN headshots and current-champion belt photos (later wins)."""
    empty = pd.DataFrame(columns=["profile_key", "historical_image_url"])
    frames = []
    for path, default_priority in ((HISTORICAL_PHOTOS_SOURCE_PATH, 0), (PHOTOS_MANIFEST_PATH, 1)):
        if not path.exists():
            continue
        photos_df = pd.read_csv(path, keep_default_na=False)
        photos_df = photos_df[photos_df["local_path"].astype(str).str.strip().ne("")].copy()
        if photos_df.empty:
            continue
        # fighter_photos.csv stores the web path (with a cache-busting version); in the historical CSV
        # image_url is the original source URL, so there the path is derived from the local file name.
        stored = photos_df["image_url"] if path == PHOTOS_MANIFEST_PATH else ["" for _ in range(len(photos_df))]
        photos_df["historical_image_url"] = [
            url or HISTORICAL_PHOTOS_URL_PREFIX + Path(str(local)).name for url, local in zip(stored, photos_df["local_path"])
        ]
        kinds = photos_df["kind"] if "kind" in photos_df.columns else ["" for _ in range(len(photos_df))]
        photos_df["priority"] = [PHOTO_KIND_PRIORITY.get(kind, default_priority) for kind in kinds]
        photos_df["profile_key"] = photos_df["name"].apply(_normalize_name)
        frames.append(photos_df[["profile_key", "historical_image_url", "priority"]])
    if not frames:
        return empty
    photos = pd.concat(frames, ignore_index=True).sort_values("priority", kind="stable")
    return photos.drop_duplicates(subset=["profile_key"], keep="last")[["profile_key", "historical_image_url"]]


def _load_origins() -> pd.DataFrame:
    """Hometown and the country each fighter represents (flag) (data/raw/fighter_origins.csv, keyed by fighter_url)."""
    empty = pd.DataFrame(columns=["fighter_url", *ORIGIN_COLUMNS])
    if not ORIGINS_SOURCE_PATH.exists():
        return empty
    origins = pd.read_csv(ORIGINS_SOURCE_PATH, keep_default_na=False)
    origins = origins[origins["fighter_url"].astype(str).str.strip().ne("")]
    origins = origins.drop_duplicates(subset=["fighter_url"], keep="last")[["fighter_url", *ORIGIN_COLUMNS]]
    return _apply_hometown_overrides(origins)


def _apply_hometown_overrides(origins: pd.DataFrame) -> pd.DataFrame:
    """Hand-written hometowns (data/raw/hometown_overrides.csv) win over ufc.com, which sometimes lists only a country.

    The daily scraper never touches that file, so a correction made once stays."""
    if not HOMETOWN_OVERRIDES_PATH.exists():
        return origins
    overrides = pd.read_csv(HOMETOWN_OVERRIDES_PATH, keep_default_na=False)
    overrides = overrides[overrides["fighter_url"].astype(str).str.strip().ne("") & overrides["hometown"].astype(str).str.strip().ne("")]
    hometown_by_url = dict(zip(overrides["fighter_url"], overrides["hometown"].astype(str).str.strip()))
    origins = origins.copy()
    origins["hometown"] = [hometown_by_url.get(url, hometown) for url, hometown in zip(origins["fighter_url"], origins["hometown"])]
    return origins


def _load_career_stats() -> pd.DataFrame:
    empty = pd.DataFrame(columns=CAREER_STATS_COLUMNS)
    if not CAREER_STATS_SOURCE_PATH.exists():
        return empty

    stats_df = pd.read_csv(CAREER_STATS_SOURCE_PATH)
    stats_df["fighter_url"] = stats_df["fighter_url"].astype(str).str.strip()
    stats_df["age"] = stats_df["dob"].apply(_age_from_dob)
    stats_df["sig_str_acc"] = stats_df["sig_str_acc"].apply(_parse_percent)
    stats_df["takedown_acc"] = stats_df["takedown_acc"].apply(_parse_percent)
    stats_df["str_def"] = stats_df["str_def"].apply(_parse_percent)
    stats_df["td_def"] = stats_df["td_def"].apply(_parse_percent)
    for column in ("slpm", "sapm", "td_avg", "sub_avg"):
        stats_df[column] = pd.to_numeric(stats_df[column], errors="coerce") if column in stats_df.columns else float("nan")
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
    empty = pd.DataFrame(columns=["profile_key", "division", "tracked_bouts", "last_fight_date"])
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
    last_fight = history.groupby("profile_key")["event_date"].max().rename("last_fight_date").reset_index()
    bouts = bouts.merge(last_fight, on="profile_key", how="left")
    latest_division = (
        history.dropna(subset=["event_date"])
        .sort_values("event_date")
        .groupby("profile_key", as_index=False)
        .tail(1)[["profile_key", "division"]]
    )

    return bouts.merge(latest_division, on="profile_key", how="left")


_catalog_cache: dict = {"signature": None, "data": None}


def _source_signature() -> tuple:
    paths = [
        FIGHTERS_SOURCE_PATH,
        FIGHTS_SOURCE_PATH,
        CAREER_STATS_SOURCE_PATH,
        HISTORICAL_PHOTOS_SOURCE_PATH,
        PHOTOS_MANIFEST_PATH,
        ORIGINS_SOURCE_PATH,
        HOMETOWN_OVERRIDES_PATH,
        NAME_ALIASES_PATH,
        STATUS_OVERRIDES_PATH,
        ROSTER_SOURCE_PATH,
        BMF_FIGHTS_SOURCE_PATH,
    ]
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
    fights_df = pd.read_csv(FIGHTS_SOURCE_PATH, usecols=["fight_url", "fighter_1"])
    without_url = fights_df["fight_url"].isna() & fights_df["fighter_1"].notna()
    return int(fights_df["fight_url"].dropna().nunique() + without_url.sum())


def get_latest_fight_date() -> str | None:
    """ISO date of the most recent fight in the dataset (shows how fresh the data is)."""
    if not FIGHTS_SOURCE_PATH.exists():
        return None
    dates = pd.to_datetime(pd.read_csv(FIGHTS_SOURCE_PATH, usecols=["event_date"])["event_date"], errors="coerce")
    latest = dates.max()
    return None if pd.isna(latest) else latest.date().isoformat()


def list_fighters(ufc_only: bool = False) -> list[dict]:
    """Every fighter in the catalog; with `ufc_only`, only those who fought in the UFC or are on the roster/a card.

    The catalog also holds fighters from other promotions (status "never"): they feed the model but are not part of
    what the site shows or lets you pick."""
    catalog = get_fighter_catalog()
    if ufc_only:
        catalog = catalog[catalog["ufc_status"] != "never"]
    records = catalog.to_dict(orient="records")
    try:
        from backend.app.services.elo_service import _cache, _calculate_elo_ratings
        _calculate_elo_ratings()
        current_elo = _cache.get("current_elo", {})
        peak_elo = _cache.get("peak_elo", {})
        ranks_active = _cache.get("ranks_active", {})
        for r in records:
            key = _normalize_name(r["name"])
            if key in current_elo:
                r["elo"] = round(current_elo[key])
                r["peak_elo"] = round(peak_elo.get(key, current_elo[key]))
                r["elo_rank"] = ranks_active.get(key)
    except Exception:
        pass
    return [_format_profile(row) for row in records]


def get_fighter_profile(name: str) -> dict:
    catalog = get_fighter_catalog()
    match = catalog.loc[catalog["name"] == (canonical_name(name) or name)]
    if match.empty:
        for org_id in ("one", "pfl", "bellator"):
            try:
                from backend.app.services.org_service import get_org_fighters, _name_key
                org_fighters = get_org_fighters(org_id)
                target_key = _name_key(name)
                found = next((f for f in org_fighters if _name_key(f["name"]) == target_key), None)
                if found:
                    wins = int(found.get("wins") or 0)
                    losses = int(found.get("losses") or 0)
                    draws = int(found.get("draws") or 0)
                    total = wins + losses + draws
                    win_rate = wins / total if total > 0 else 0.5
                    return {
                        "name": found["name"],
                        "is_active": bool(found.get("is_active", False)),
                        "nickname": _nullable_string(found.get("nickname")),
                        "age": _to_float(found.get("age")) or 30.0,
                        "height_cm": _to_float(found.get("height_cm")) or 178.0,
                        "weight_lbs": _to_float(found.get("weight_lbs")) or 155.0,
                        "reach_cm": _to_float(found.get("reach_cm")) or 183.0,
                        "wins": wins,
                        "losses": losses,
                        "draws": draws,
                        "total_fights": total,
                        "win_rate": _to_float(found.get("win_rate")) or round(win_rate, 3),
                        "sig_str_acc": _to_float(found.get("sig_str_acc")) or 0.45,
                        "takedown_acc": _to_float(found.get("takedown_acc")) or 0.40,
                        "stance": found.get("stance") or "Orthodox",
                        "division": _nullable_string(found.get("division")),
                        "image_url": _nullable_string(found.get("image_url")),
                        "country": _nullable_string(found.get("country")),
                        "country_code": _nullable_string(found.get("country_code")),
                        "hometown": _nullable_string(found.get("hometown")),
                        "belt": bool(found.get("belt", False)),
                        "title_status": _nullable_string(found.get("title_status")),
                        "ranking": _nullable_string(found.get("ranking")),
                        "org_fights": int(found.get("org_fights") or 0),
                    }
            except Exception:
                pass
        raise KeyError(f"Fighter '{name}' was not found in the catalog.")

    rec = match.iloc[0].to_dict()
    try:
        from backend.app.services.elo_service import get_fighter_elo
        elo_info = get_fighter_elo(rec["name"])
        rec["elo"] = elo_info.get("elo")
        rec["peak_elo"] = elo_info.get("peak_elo")
        rec["elo_rank"] = elo_info.get("p4p_rank")
    except Exception:
        pass

    return _format_profile(rec)


def _format_profile(record: dict) -> dict:
    try:
        from backend.app.services.events_service import get_fighter_upcoming_bouts
        upcoming = get_fighter_upcoming_bouts(record["name"])
    except Exception:
        upcoming = []

    return {
        "name": record["name"],
        "is_active": bool(record.get("is_active", False)),
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
        "sig_strikes_landed_per_min": _to_float(record.get("slpm")),
        "sig_strikes_absorbed_per_min": _to_float(record.get("sapm")),
        "striking_defense": _to_float(record.get("str_def")),
        "takedown_avg_per_15min": _to_float(record.get("td_avg")),
        "takedown_defense": _to_float(record.get("td_def")),
        "submission_avg_per_15min": _to_float(record.get("sub_avg")),
        "stance": record.get("stance") or "Unknown",
        "division": _nullable_string(record.get("division")),
        "belt": bool(record.get("belt", False)),
        "ranking": _nullable_string(record.get("ranking")),
        "rank_signal": _nullable_string(record.get("rank_signal")),
        "image_url": _nullable_string(record.get("image_url")),
        "fighter_url": _nullable_string(record.get("fighter_url")),
        "hometown": _nullable_string(record.get("hometown")),
        "country": _nullable_string(record.get("country")),
        "country_code": _nullable_string(record.get("country_code")),
        "ufc_status": _nullable_string(record.get("ufc_status")) or "never",
        "badges": [badge for badge in (_nullable_string(record.get("badges")) or "").split("|") if badge],
        "current_titles": _current_titles(record.get("fighter_url"), record.get("name"), record.get("badges")),
        "former_titles": _former_titles(record.get("fighter_url"), record.get("name")),
        "interim_titles": _interim_titles(record.get("fighter_url"), record.get("name")),
        "nationalities": _nationalities(record),
        "ufc_debut": _nullable_string(record.get("ufc_debut")),
        "ufc_last_fight": _nullable_string(record.get("ufc_last_fight")),
        "roster_url": _nullable_string(record.get("roster_url")),
        "elo": record.get("elo"),
        "peak_elo": record.get("peak_elo"),
        "elo_rank": record.get("elo_rank"),
        "next_fight": upcoming[0] if upcoming else None,
        "upcoming_fights": upcoming,
    }


_championship_cache: dict = {
    "signature": "unset",
    "former_url": {},
    "former_name": {},
    "current_url": {},
    "current_name": {},
}


def _championship_maps() -> tuple[dict[str, list[str]], dict[str, list[str]], dict[str, list[str]], dict[str, list[str]]]:
    """Undisputed titles a fighter holds today, and ones they held and no longer do."""
    signature = TITLE_REIGNS_SOURCE_PATH.stat().st_mtime_ns if TITLE_REIGNS_SOURCE_PATH.exists() else None
    cached = _championship_cache
    if cached["signature"] == signature:
        return cached["former_url"], cached["former_name"], cached["current_url"], cached["current_name"]
    former_url: dict[str, list[str]] = {}
    former_name: dict[str, list[str]] = {}
    current_url: dict[str, list[str]] = {}
    current_name: dict[str, list[str]] = {}
    if signature is not None:
        reigns = pd.read_csv(TITLE_REIGNS_SOURCE_PATH, keep_default_na=False)
        undisputed = reigns[reigns["title_type"].astype(str).str.strip().eq("undisputed")]
        current = {
            (str(row.fighter_url).strip(), str(row.division).strip())
            for row in undisputed.itertuples(index=False)
            if str(row.is_current).strip().lower() == "true"
        }
        current_names = {
            (_normalize_name(str(row.champion)), str(row.division).strip())
            for row in undisputed.itertuples(index=False)
            if str(row.is_current).strip().lower() == "true"
        }
        former_seen_url: dict[str, set[str]] = {}
        former_seen_name: dict[str, set[str]] = {}
        current_seen_url: dict[str, set[str]] = {}
        current_seen_name: dict[str, set[str]] = {}
        for row in undisputed.itertuples(index=False):
            division = str(row.division).strip()
            url = str(row.fighter_url).strip()
            name = _normalize_name(str(row.champion))
            is_current = str(row.is_current).strip().lower() == "true"
            if is_current:
                if url:
                    current_seen_url.setdefault(url, set()).add(division)
                if name:
                    current_seen_name.setdefault(name, set()).add(division)
                continue
            if (url, division) in current or (name, division) in current_names:
                continue
            if url:
                former_seen_url.setdefault(url, set()).add(division)
            if name:
                former_seen_name.setdefault(name, set()).add(division)
        former_url = {url: sorted(divisions) for url, divisions in former_seen_url.items()}
        former_name = {name: sorted(divisions) for name, divisions in former_seen_name.items()}
        current_url = {url: sorted(divisions) for url, divisions in current_seen_url.items()}
        current_name = {name: sorted(divisions) for name, divisions in current_seen_name.items()}
    _championship_cache.update({
        "signature": signature,
        "former_url": former_url,
        "former_name": former_name,
        "current_url": current_url,
        "current_name": current_name,
    })
    return former_url, former_name, current_url, current_name


_interim_cache: dict = {"signature": None, "by_url": {}, "by_name": {}}


def _interim_maps() -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Divisions where a fighter held the interim title and never went on to win the title itself.

    A fighter who later won the division's undisputed belt (the usual interim-to-champion path) is not listed: the
    interim win shows on that fight in their history instead."""
    signature = TITLE_REIGNS_SOURCE_PATH.stat().st_mtime_ns if TITLE_REIGNS_SOURCE_PATH.exists() else None
    if _interim_cache["signature"] != signature:
        by_url: dict[str, set[str]] = {}
        by_name: dict[str, set[str]] = {}
        if signature is not None:
            reigns = pd.read_csv(TITLE_REIGNS_SOURCE_PATH, keep_default_na=False)
            types = reigns["title_type"].astype(str).str.strip()
            undisputed_dates: dict[tuple[str, str], list[str]] = {}
            for row in reigns[types.eq("undisputed")].itertuples(index=False):
                division = str(row.division).strip()
                for who in (str(row.fighter_url).strip(), _normalize_name(str(row.champion))):
                    if who:
                        undisputed_dates.setdefault((who, division), []).append(str(row.date_won))
            for row in reigns[types.eq("interim")].itertuples(index=False):
                division = str(row.division).strip()
                url, name = str(row.fighter_url).strip(), _normalize_name(str(row.champion))
                later_title = any(
                    d > str(row.date_won) for who in (url, name) if who for d in undisputed_dates.get((who, division), [])
                )
                if later_title:
                    continue
                if url:
                    by_url.setdefault(url, set()).add(division)
                if name:
                    by_name.setdefault(name, set()).add(division)
        _interim_cache.update(
            signature=signature,
            by_url={key: sorted(value) for key, value in by_url.items()},
            by_name={key: sorted(value) for key, value in by_name.items()},
        )
    return _interim_cache["by_url"], _interim_cache["by_name"]


def _interim_titles(fighter_url, name) -> list[str]:
    by_url, by_name = _interim_maps()
    return _titles_for(fighter_url, name, by_url, by_name)


def _titles_for(fighter_url, name, by_url: dict[str, list[str]], by_name: dict[str, list[str]]) -> list[str]:
    url = _nullable_string(fighter_url)
    if url and url in by_url:
        return by_url[url]
    return by_name.get(_normalize_name(str(name or "")), [])


def _former_titles(fighter_url, name) -> list[str]:
    former_url, former_name, _, _ = _championship_maps()
    return _titles_for(fighter_url, name, former_url, former_name)


def _current_titles(fighter_url, name, badges) -> list[str]:
    """Divisions held today, with BMF first when this fighter is the reigning BMF champion."""
    _, _, current_url, current_name = _championship_maps()
    titles = _titles_for(fighter_url, name, current_url, current_name)
    badge_list = [badge for badge in (_nullable_string(badges) or "").split("|") if badge]
    if "bmf_current" in badge_list:
        return ["BMF", *titles]
    return titles


def _with_current_bmf(catalog: pd.DataFrame) -> pd.Series:
    """The reigning BMF champion gets "bmf_current" in place of the "bmf" badge (everyone else keeps "bmf")."""
    badges = catalog["badges"].fillna("")
    champion = current_bmf_champion()
    if not champion:
        return badges
    is_champion = catalog["profile_key"].eq(_normalize_name(champion))

    def swap(value: str) -> str:
        kept = [badge for badge in value.split("|") if badge and badge != "bmf"]
        return "|".join(["bmf_current", *kept])

    return badges.where(~is_champion, badges.map(swap))


def _nationalities(record: dict) -> list[dict]:
    """Every nationality roster.watch lists, the country the fighter represents first."""
    names = (_nullable_string(record.get("roster_countries")) or "").split("|")
    codes = (_nullable_string(record.get("roster_country_codes")) or "").split("|")
    return [{"name": name, "code": code or None} for name, code in zip(names, codes) if name]


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


def _debut_division(roster_classes: object, weight_lbs: float | None, female: bool) -> str | None:
    """Division for a fighter with no UFC fight on record. roster.watch lists weight classes ("middleweight, welterweight");
    the one matching the profile weight wins, else the first listed ("openweight" is not a division). Without roster
    data the profile weight alone decides, and women get the women's divisions."""
    listed = [] if roster_classes is None or pd.isna(roster_classes) else str(roster_classes).split(",")
    listed = [d for d in (_format_division(item) for item in listed) if d and d.lower() != "openweight"]
    guess = _division_from_weight(weight_lbs, female)
    if guess in listed or not listed:
        return guess
    return listed[0]


def _division_from_weight(weight_lbs: float | None, female: bool = False) -> str | None:
    if weight_lbs is None or pd.isna(weight_lbs):
        return None
    if female:
        for limit, division in ((115, "Strawweight"), (125, "Flyweight"), (135, "Bantamweight")):
            if weight_lbs <= limit:
                return f"Women's {division}"
        return "Women's Featherweight"
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
