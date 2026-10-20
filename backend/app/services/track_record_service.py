"""How the model does on real fights: predictions are logged before a fight and checked once the result is in.

data/raw/prediction_log.csv holds one row per fight. scripts/log_predictions.py adds a row (with the model's pick and
confidence at that moment) for every announced fight and later fills in the winner. Nothing is back-filled: a
prediction made after the fact, with today's stats, would not be a prediction.
"""

from __future__ import annotations

import pandas as pd

from src.ufc_predictor.config import RAW_DATA_DIR

PREDICTION_LOG_PATH = RAW_DATA_DIR / "prediction_log.csv"
LOG_COLUMNS = [
    "fight_key",
    "event_name",
    "event_date",
    "fighter_1",
    "fighter_2",
    "prob_fighter_1",
    "predicted_winner",
    "confidence",
    "logged_at",
    "winner",
    "correct",
    "resolved_at",
]
CONFIDENCE_BANDS = [(0.5, 0.6, "50-60%"), (0.6, 0.7, "60-70%"), (0.7, 0.8, "70-80%"), (0.8, 1.01, "80%+")]
# Picks saved before this day came from the first version of the model, which answered differently depending on which
# fighter was listed first. From this day on the pick is the average of both orders.
SYMMETRIC_MODEL_SINCE = "2026-10-20"
RECENT_LIMIT = 15
MISS_LIMIT = 5

_cache: dict = {"signature": None, "data": None}


def load_log() -> pd.DataFrame:
    if not PREDICTION_LOG_PATH.exists():
        return pd.DataFrame(columns=LOG_COLUMNS)
    return pd.read_csv(PREDICTION_LOG_PATH, keep_default_na=False, dtype=str)


def save_log(log: pd.DataFrame) -> None:
    log[LOG_COLUMNS].to_csv(PREDICTION_LOG_PATH, index=False, lineterminator="\r\n")


def get_track_record() -> dict:
    signature = PREDICTION_LOG_PATH.stat().st_mtime_ns if PREDICTION_LOG_PATH.exists() else None
    if _cache["signature"] != signature or _cache["data"] is None:
        _cache["data"] = _build(load_log())
        _cache["signature"] = signature
    return _cache["data"]


def _build(log: pd.DataFrame) -> dict:
    if log.empty:
        return {
            "tracking_since": None,
            "logged": 0,
            "resolved": 0,
            "correct": 0,
            "accuracy": None,
            "average_confidence": None,
            "pending": 0,
            "earlier_model_picks": 0,
            "earlier_model_note": None,
            "next_event": None,
            "bands": [],
            "recent": [],
            "biggest_misses": [],
        }

    log = log.copy()
    log["confidence"] = pd.to_numeric(log["confidence"], errors="coerce")
    resolved = log[log["correct"].isin(["True", "False"])].copy()
    resolved["correct_flag"] = resolved["correct"].eq("True")
    pending = log[log["correct"] == ""]  # draws and no contests are settled but never counted either way

    next_event = None
    if not pending.empty:
        dates = pd.to_datetime(pending["event_date"], errors="coerce")
        soonest = pending.loc[dates.idxmin()] if dates.notna().any() else pending.iloc[0]
        next_event = {"name": soonest["event_name"], "date": soonest["event_date"]}

    bands = []
    for low, high, label in CONFIDENCE_BANDS:
        in_band = resolved[(resolved["confidence"] >= low) & (resolved["confidence"] < high)]
        if in_band.empty:
            continue
        bands.append(
            {
                "label": label,
                "fights": int(len(in_band)),
                "average_confidence": float(in_band["confidence"].mean()),
                "accuracy": float(in_band["correct_flag"].mean()),
            }
        )

    ordered = resolved.sort_values(["event_date", "resolved_at"], ascending=False)
    recent = [_row(row) for _, row in ordered.head(RECENT_LIMIT).iterrows()]
    misses = resolved[~resolved["correct_flag"]].sort_values("confidence", ascending=False)

    earlier = int((log["logged_at"] < SYMMETRIC_MODEL_SINCE).sum())
    return {
        "tracking_since": log["logged_at"].min() or None,
        "logged": int(len(log)),
        "resolved": int(len(resolved)),
        "correct": int(resolved["correct_flag"].sum()),
        "accuracy": float(resolved["correct_flag"].mean()) if len(resolved) else None,
        "average_confidence": float(resolved["confidence"].mean()) if len(resolved) else None,
        "pending": int(len(pending)),
        "earlier_model_picks": earlier,
        "earlier_model_note": _earlier_model_note(earlier),
        "next_event": next_event,
        "bands": bands,
        "recent": recent,
        "biggest_misses": [_row(row) for _, row in misses.head(MISS_LIMIT).iterrows()],
    }


def _earlier_model_note(count: int) -> str | None:
    if not count:
        return None
    return (
        f"{count} of these picks were saved before {SYMMETRIC_MODEL_SINCE}, by an earlier version of the model that gave "
        "a different answer depending on which fighter was listed first. They are kept exactly as they were shown. "
        "Picks saved from that day on use the corrected version."
    )


def _row(row: pd.Series) -> dict:
    return {
        "event_name": row["event_name"],
        "event_date": row["event_date"],
        "fighter_1": row["fighter_1"],
        "fighter_2": row["fighter_2"],
        "predicted_winner": row["predicted_winner"],
        "confidence": float(row["confidence"]),
        "winner": row["winner"] or None,
        "correct": row["correct"] == "True",
    }
