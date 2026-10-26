from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.services.catalog_service import _normalize_name, canonical_name, get_fighter_catalog
from src.ufc_predictor.config import RAW_DATA_DIR

logger = logging.getLogger(__name__)

EVENT_CARDS_PATH = RAW_DATA_DIR / "event_cards.csv"

_cache: dict[str, Any] = {
    "mtime": None,
    "current_elo": {},
    "peak_elo": {},
    "fights_count": {},
    "elo_history": {},
    "ranks_all_time": {},
    "ranks_active": {},
}


def _calculate_elo_ratings() -> None:
    if not EVENT_CARDS_PATH.exists():
        return

    mtime = EVENT_CARDS_PATH.stat().st_mtime_ns
    if _cache["mtime"] == mtime and _cache["current_elo"]:
        return

    df = pd.read_csv(EVENT_CARDS_PATH)
    df["date"] = pd.to_datetime(df["event_date"], errors="coerce")
    df = df.dropna(subset=["date"]).sort_values("date", ascending=True)

    current_elo: dict[str, float] = {}
    peak_elo: dict[str, float] = {}
    fights_count: dict[str, int] = {}
    elo_history: dict[str, list[dict]] = {}

    for _, row in df.iterrows():
        raw_f1 = str(row.get("fighter_1", "")).strip()
        raw_f2 = str(row.get("fighter_2", "")).strip()
        if not raw_f1 or not raw_f2:
            continue

        name1 = canonical_name(raw_f1)
        name2 = canonical_name(raw_f2)
        key1 = _normalize_name(name1)
        key2 = _normalize_name(name2)

        raw_winner = str(row.get("winner", "")).strip() if pd.notna(row.get("winner")) else ""
        winner_key = _normalize_name(canonical_name(raw_winner)) if raw_winner else ""
        method = str(row.get("method", "")).strip().upper() if pd.notna(row.get("method")) else ""

        r1 = current_elo.get(key1, 1500.0)
        r2 = current_elo.get(key2, 1500.0)

        e1 = 1.0 / (1.0 + 10.0 ** ((r2 - r1) / 400.0))
        e2 = 1.0 - e1

        c1 = fights_count.get(key1, 0)
        c2 = fights_count.get(key2, 0)
        k1 = 40.0 if c1 < 3 else 32.0
        k2 = 40.0 if c2 < 3 else 32.0

        mult = 1.0
        if "KO" in method or "SUB" in method:
            mult = 1.2
        elif "S-DEC" in method or "M-DEC" in method:
            mult = 0.85

        if winner_key == key1:
            s1, s2 = 1.0, 0.0
            res1, res2 = "win", "loss"
        elif winner_key == key2:
            s1, s2 = 0.0, 1.0
            res1, res2 = "loss", "win"
        elif "DRAW" in method or winner_key in ("draw", "empate"):
            s1, s2 = 0.5, 0.5
            res1, res2 = "draw", "draw"
        else:
            continue  # No contest / invalid

        new_r1 = r1 + k1 * mult * (s1 - e1)
        new_r2 = r2 + k2 * mult * (s2 - e2)

        current_elo[key1] = new_r1
        current_elo[key2] = new_r2
        fights_count[key1] = c1 + 1
        fights_count[key2] = c2 + 1
        peak_elo[key1] = max(peak_elo.get(key1, 1500.0), new_r1)
        peak_elo[key2] = max(peak_elo.get(key2, 1500.0), new_r2)

        date_str = row["date"].strftime("%Y-%m-%d") if pd.notna(row["date"]) else ""
        event_title = str(row.get("event_name", ""))

        if key1 not in elo_history:
            elo_history[key1] = []
        if key2 not in elo_history:
            elo_history[key2] = []

        elo_history[key1].append({
            "date": date_str,
            "event": event_title,
            "opponent": name2,
            "result": res1,
            "elo_after": round(new_r1),
            "elo_change": round(new_r1 - r1),
        })
        elo_history[key2].append({
            "date": date_str,
            "event": event_title,
            "opponent": name1,
            "result": res2,
            "elo_after": round(new_r2),
            "elo_change": round(new_r2 - r2),
        })

    # Precalculate P4P ranks (All-time and Active)
    catalog = get_fighter_catalog()
    active_keys = set()
    if not catalog.empty:
        for row in catalog.itertuples():
            status = getattr(row, "ufc_status", None) or getattr(row, "status", None)
            if status == "active" or getattr(row, "is_active", False):
                active_keys.add(_normalize_name(getattr(row, "name", "")))

    sorted_all = sorted(current_elo.items(), key=lambda x: x[1], reverse=True)
    ranks_all: dict[str, int] = {}
    for rank, (k, _) in enumerate(sorted_all, start=1):
        ranks_all[k] = rank

    sorted_active = [item for item in sorted_all if item[0] in active_keys]
    ranks_active: dict[str, int] = {}
    for rank, (k, _) in enumerate(sorted_active, start=1):
        ranks_active[k] = rank

    _cache["mtime"] = mtime
    _cache["current_elo"] = current_elo
    _cache["peak_elo"] = peak_elo
    _cache["fights_count"] = fights_count
    _cache["elo_history"] = elo_history
    _cache["ranks_all_time"] = ranks_all
    _cache["ranks_active"] = ranks_active


def get_fighter_elo(name: str) -> dict[str, Any]:
    """Get Elo rating details for a fighter."""
    _calculate_elo_ratings()
    key = _normalize_name(canonical_name(name))
    
    elo = round(_cache["current_elo"].get(key, 1500.0))
    peak = round(_cache["peak_elo"].get(key, 1500.0))
    fights = _cache["fights_count"].get(key, 0)
    p4p_active_rank = _cache["ranks_active"].get(key)
    p4p_all_rank = _cache["ranks_all_time"].get(key)
    history = _cache["elo_history"].get(key, [])

    return {
        "name": canonical_name(name),
        "elo": elo,
        "peak_elo": peak,
        "ufc_fights": fights,
        "p4p_rank": p4p_active_rank,
        "all_time_rank": p4p_all_rank,
        "history": history[-10:] if history else [],
    }


def get_elo_leaderboard(division: str | None = None, active_only: bool = True, limit: int = 50) -> list[dict[str, Any]]:
    """Return top fighters ranked by Elo."""
    _calculate_elo_ratings()
    catalog = get_fighter_catalog()
    catalog_map = {}
    if not catalog.empty:
        for row in catalog.to_dict(orient="records"):
            catalog_map[_normalize_name(row["name"])] = row

    results = []
    for key, score in _cache["current_elo"].items():
        profile = catalog_map.get(key)
        if not profile:
            continue

        is_active = profile.get("ufc_status") == "active" or profile.get("is_active") is True
        if active_only and not is_active:
            continue

        if division:
            f_div = profile.get("weight_class") or profile.get("division") or ""
            if division.lower() not in f_div.lower():
                continue

        results.append({
            "name": profile["name"],
            "division": profile.get("weight_class") or profile.get("division") or "Unknown",
            "elo": round(score),
            "peak_elo": round(_cache["peak_elo"].get(key, score)),
            "fights": _cache["fights_count"].get(key, 0),
            "wins": profile.get("wins", 0),
            "losses": profile.get("losses", 0),
            "draws": profile.get("draws", 0),
            "image_url": profile.get("image_url"),
            "belt": bool(profile.get("belt")),
            "active": is_active,
        })

    results.sort(key=lambda x: x["elo"], reverse=True)
    for idx, item in enumerate(results, start=1):
        item["rank"] = idx

    return results[:limit]
