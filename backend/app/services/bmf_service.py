"""BMF title fights (data/raw/bmf_title_fights.csv) and the current BMF champion.

The BMF belt is not a divisional title, so title_fight in the fight data is False for these fights. The file lists
every BMF title fight with its winner; the current champion is the winner of the most recent one. Add a row after each
BMF title fight (a defense included) and everything else follows.
"""

from __future__ import annotations

import re
import time

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

BMF_FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "bmf_title_fights.csv"

_cache: dict = {"signature": "unset", "fight_urls": frozenset(), "pending_pairs": frozenset(), "champion": None, "checked": 0.0}


def _name_key(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value).lower())).strip()


def _load() -> None:
    # Asked once per fight when a whole archive is built: look at the file at most once a second.
    now = time.monotonic()
    if _cache["signature"] != "unset" and now - _cache["checked"] < 1.0:
        return
    _cache["checked"] = now
    signature = BMF_FIGHTS_SOURCE_PATH.stat().st_mtime_ns if BMF_FIGHTS_SOURCE_PATH.exists() else None
    if _cache["signature"] == signature:
        return
    fight_urls: frozenset[str] = frozenset()
    pending_pairs: frozenset[frozenset[str]] = frozenset()
    champion = None
    if signature is not None:
        fights = pd.read_csv(BMF_FIGHTS_SOURCE_PATH, keep_default_na=False)
        fight_urls = frozenset(url for url in fights["fight_url"].astype(str) if url)
        decided = fights[fights["winner"].astype(str).str.strip().ne("")].sort_values("date")
        champion = str(decided.iloc[-1]["winner"]).strip() if not decided.empty else None
        pending = fights[fights["winner"].astype(str).str.strip().eq("")]
        pending_pairs = frozenset(
            frozenset({_name_key(row.fighter_1), _name_key(row.fighter_2)})
            for row in pending.itertuples(index=False)
            if str(row.fighter_1).strip() and str(row.fighter_2).strip()
        )
    _cache.update({"signature": signature, "fight_urls": fight_urls, "pending_pairs": pending_pairs, "champion": champion})


def is_bmf_title_fight(fight_url: str | None) -> bool:
    _load()
    return bool(fight_url) and fight_url in _cache["fight_urls"]


def is_announced_bmf_bout(fighter_1: str | None, fighter_2: str | None) -> bool:
    """A booked BMF title fight that has no result yet (the winner cell in the CSV is blank)."""
    _load()
    if not fighter_1 or not fighter_2:
        return False
    return frozenset({_name_key(fighter_1), _name_key(fighter_2)}) in _cache["pending_pairs"]


def current_bmf_champion() -> str | None:
    """Name of the reigning BMF champion, or None when the file is missing or empty."""
    _load()
    return _cache["champion"]
