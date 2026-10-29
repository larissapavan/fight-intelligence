from __future__ import annotations

import json
import logging
from pathlib import Path
from src.ufc_predictor.config import RAW_DATA_DIR

logger = logging.getLogger(__name__)

CACHE_FILE = RAW_DATA_DIR / "career_history_cache.json"

_memory_cache: dict[str, dict] = {}
_cache_mtime: float = 0.0


def _load_cache() -> dict[str, dict]:
    global _memory_cache, _cache_mtime
    if CACHE_FILE.exists():
        try:
            mtime = CACHE_FILE.stat().st_mtime
            if mtime != _cache_mtime:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    _memory_cache = json.load(f)
                    _cache_mtime = mtime
        except Exception as e:
            logger.warning("Could not read career_history_cache.json: %s", e)
    return _memory_cache


def get_career_history(fighter_name: str) -> dict | None:
    """Return the complete MMA career history (UFC + all other organizations) for a fighter.
    
    Returns:
        dict with:
            - ufc_record: {total, wins, losses, draws, nc, win_rate}
            - complete_record: {total, wins, losses, draws, nc, win_rate}
            - organizations: list[str]
            - fights: list[dict]
    """
    cache = _load_cache()
    
    # Try direct match
    if fighter_name in cache:
        return cache[fighter_name]
        
    # Try normalized match (case-insensitive, no extra spaces)
    norm = fighter_name.strip().lower()
    for name, data in cache.items():
        if name.strip().lower() == norm:
            return data
            
    return None
