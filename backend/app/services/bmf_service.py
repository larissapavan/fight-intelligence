"""BMF title fights (data/raw/bmf_title_fights.csv) and the current BMF champion.

The BMF belt is not a divisional title, so title_fight in the fight data is False for these fights. The file lists
every BMF title fight with its winner; the current champion is the winner of the most recent one. Add a row after each
BMF title fight (a defense included) and everything else follows.
"""

from __future__ import annotations

import time

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

BMF_FIGHTS_SOURCE_PATH = RAW_DATA_DIR / "bmf_title_fights.csv"

_cache: dict = {"signature": "unset", "fight_urls": frozenset(), "champion": None, "checked": 0.0}


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
    champion = None
    if signature is not None:
        fights = pd.read_csv(BMF_FIGHTS_SOURCE_PATH, keep_default_na=False)
        fight_urls = frozenset(url for url in fights["fight_url"].astype(str) if url)
        decided = fights[fights["winner"].astype(str).str.strip().ne("")].sort_values("date")
        champion = str(decided.iloc[-1]["winner"]).strip() if not decided.empty else None
    _cache.update({"signature": signature, "fight_urls": fight_urls, "champion": champion})


def is_bmf_title_fight(fight_url: str | None) -> bool:
    _load()
    return bool(fight_url) and fight_url in _cache["fight_urls"]


def current_bmf_champion() -> str | None:
    """Name of the reigning BMF champion, or None when the file is missing or empty."""
    _load()
    return _cache["champion"]
