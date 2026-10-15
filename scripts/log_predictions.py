"""Keep the model's track record: log a prediction for every announced fight, then settle it once the result is in.

Two steps, run around the ESPN refresh in scripts.update_all:
    log_upcoming()  before it, while the cards are still "upcoming": the pick and confidence are stored with the stats
                    as they are that day. A fight already in the log is never re-predicted.
    resolve()       after it, when finished fights have a winner: marks each logged pick right or wrong.

Nothing is back-filled. Predicting an old fight with today's career numbers would not be a prediction.

Usage (from the repo root):
    python -m scripts.log_predictions            # log, then resolve
    python -m scripts.log_predictions --resolve-only
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import pandas as pd

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.catalog_service import _normalize_name, canonical_name
from backend.app.services.events_service import get_upcoming_events
from backend.app.services.fight_history_service import _load_fight_history
from backend.app.services.track_record_service import LOG_COLUMNS, load_log, save_log


def fight_key(event_date: str, fighter_1: str, fighter_2: str) -> str:
    """The same fight whichever corner is listed first."""
    first, second = sorted([_normalize_name(canonical_name(fighter_1)), _normalize_name(canonical_name(fighter_2))])
    return f"{event_date}|{first}|{second}"


def log_upcoming(service=None, today: str | None = None) -> int:
    """Add a prediction for every announced fight that is not in the log yet. Returns how many were added."""
    if service is None:
        from backend.app.services.prediction_service import PredictionService

        service = PredictionService()
    today = today or date.today().isoformat()
    log = load_log()
    known = set(log["fight_key"])

    added = []
    for event in get_upcoming_events():
        if not event["date"] or event["date"] < today:
            continue
        for fight in event["fights"]:
            fighter_1, fighter_2 = fight["fighter_1"], fight["fighter_2"]
            if not fighter_1 or not fighter_2:
                continue
            key = fight_key(event["date"], fighter_1, fighter_2)
            if key in known:
                continue
            try:
                result = service.predict_pick(fighter_1, fighter_2)
            except KeyError:
                continue  # a debutant we have no profile for yet: nothing to predict from
            known.add(key)
            added.append(
                {
                    "fight_key": key,
                    "event_name": event["name"],
                    "event_date": event["date"],
                    "fighter_1": fighter_1,
                    "fighter_2": fighter_2,
                    "prob_fighter_1": f"{result['fighter_a_probability']:.4f}",
                    "predicted_winner": result["predicted_winner"],
                    "confidence": f"{result['probability']:.4f}",
                    "logged_at": today,
                    "winner": "",
                    "correct": "",
                    "resolved_at": "",
                }
            )
    if added:
        save_log(pd.concat([log, pd.DataFrame(added, columns=LOG_COLUMNS)], ignore_index=True))
    return len(added)


def resolve(today: str | None = None) -> int:
    """Settle logged fights whose result is now in the fight history. Returns how many were settled."""
    today = today or date.today().isoformat()
    log = load_log()
    pending = log.index[log["correct"] == ""]
    if len(pending) == 0:
        return 0

    history = _load_fight_history()
    if history.empty:
        return 0
    finished: dict[str, str | None] = {}
    for row in history.itertuples():
        if pd.isna(row.event_date_parsed):
            continue
        key = fight_key(row.event_date_parsed.date().isoformat(), row.fighter_1, row.fighter_2)
        winner = row.winner if isinstance(row.winner, str) and row.winner.strip() else None
        finished[key] = winner

    settled = 0
    for index in pending:
        key = log.at[index, "fight_key"]
        if key not in finished:
            continue
        winner = finished[key]
        if winner is None:  # a draw or no contest counts for neither side
            log.loc[index, ["winner", "correct", "resolved_at"]] = ["Draw / no contest", "n/a", today]
        else:
            right = _normalize_name(winner) == _normalize_name(log.at[index, "predicted_winner"])
            log.loc[index, ["winner", "correct", "resolved_at"]] = [winner, str(right), today]
        settled += 1
    if settled:
        save_log(log)
    return settled


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--resolve-only", action="store_true")
    args = parser.parse_args(argv)

    if not args.resolve_only:
        print(f"[info] predictions logged: {log_upcoming()}")
    print(f"[info] predictions settled: {resolve()}")


if __name__ == "__main__":
    main()
