from __future__ import annotations

import logging
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from backend.app.services.catalog_service import _normalize_name, canonical_name
from backend.app.services.track_record_service import get_track_record, load_log, save_log
from scripts.log_predictions import fight_key, log_upcoming, resolve
from src.ufc_predictor.config import RAW_DATA_DIR

logger = logging.getLogger(__name__)

EVENT_CARDS_PATH = RAW_DATA_DIR / "event_cards.csv"
UPCOMING_EVENTS_PATH = RAW_DATA_DIR / "upcoming_events.csv"


def sync_and_settle(today: str | None = None) -> dict[str, Any]:
    """Sync latest results, settle pending predictions, log new upcoming fights and recalculate metrics."""
    today = today or date.today().isoformat()
    log_before = load_log()
    pending_before = len(log_before[log_before["correct"] == ""])

    # 1. Try to settle any pending fights against fight history
    settled = resolve(today=today)

    # 2. Try to log any new announced upcoming fights
    try:
        logged_new = log_upcoming(today=today)
    except Exception as exc:
        logger.warning("Could not auto-log upcoming fights: %s", exc)
        logged_new = 0

    # 3. Clean up upcoming_events.csv: remove past events that took place
    try:
        if UPCOMING_EVENTS_PATH.exists():
            up_df = pd.read_csv(UPCOMING_EVENTS_PATH)
            if "event_date" in up_df.columns:
                valid_future = up_df[up_df["event_date"].fillna("").ge(today)]
                if len(valid_future) < len(up_df):
                    valid_future.to_csv(UPCOMING_EVENTS_PATH, index=False)
    except Exception as exc:
        logger.debug("Failed to prune upcoming_events: %s", exc)

    # 4. Get refreshed track record summary
    track = get_track_record()

    # Invalidate Elo cache so it recomputes with any newly settled fights
    try:
        from backend.app.services.elo_service import _calculate_elo_ratings
        _calculate_elo_ratings()
    except Exception as exc:
        logger.debug("Failed to refresh Elo after settlement: %s", exc)

    accuracy_pct = f"{round(track['accuracy'] * 100, 1)}%" if track.get("accuracy") is not None else "—"

    if settled > 0:
        msg = f"Sucesso! {settled} nova(s) luta(s) liquidada(s). Acurácia atual: {accuracy_pct}."
    else:
        msg = f"Nenhum resultado pendente para liquidar no momento. {track.get('pending', 0)} palpites aguardando lutas futuras."

    return {
        "status": "success",
        "settled_count": settled,
        "new_logged_count": logged_new,
        "total_resolved": track.get("resolved", 0),
        "total_correct": track.get("correct", 0),
        "accuracy": track.get("accuracy"),
        "pending": track.get("pending", 0),
        "message": msg,
    }
