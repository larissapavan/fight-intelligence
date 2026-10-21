"""How the deployed model does when it is checked again, and what the site says about it.

The accuracy in the model's own file was measured when it was trained, on data that is not in this repository, and it
could not be reproduced. scripts/compare_models.py scores the deployed model on the newest fights (each fighter's age and
record as of the fight) and writes the result next to the model file. The API sends that result to the site, which shows
it instead of the reported number, and builds the note and the limitations below from it.
"""

from __future__ import annotations

import json
from datetime import date

from src.ufc_predictor.config import MODEL_PATH

EVALUATION_PATH = MODEL_PATH.with_suffix(".evaluation.json")


def load_recent_evaluation() -> dict | None:
    """The saved result, or None when scripts/compare_models.py has not been run."""
    if not EVALUATION_PATH.exists():
        return None
    try:
        data = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and {"fights", "accuracy", "roc_auc", "log_loss"} <= set(data) else None


def _month(iso_day: str) -> str:
    return date.fromisoformat(iso_day).strftime("%B %Y")


def metrics_note(evaluation: dict | None, reported_accuracy: float | None) -> str:
    """The sentence shown under the model's headline numbers."""
    reported = f"{reported_accuracy:.1%}" if reported_accuracy is not None else "a higher figure"
    if evaluation is None:
        return (
            f"These numbers are what the model's file says it measured when it was trained ({reported} accuracy), on data that is "
            "not in this repository, so they could not be checked. Read its probabilities as rough."
        )
    sentence = (
        f"Measured on {evaluation['fights']:,} recent fights ({_month(evaluation['start'])} to {_month(evaluation['end'])}), "
        "given each fighter's age and record as of the fight. "
        f"The model's own file reports {reported} accuracy, from when it was trained on data that is not in this repository; that could not be reproduced."
    )
    if evaluation.get("confident_hit_rate") is not None:
        sentence += f" The picks it rated {evaluation['confident_threshold']:.0%} or more were right {evaluation['confident_hit_rate']:.0%} of the time."
    return sentence + " Read its probabilities as rough."


def evaluation_limitations(evaluation: dict | None, reported_accuracy: float | None) -> list[str]:
    """Limitations that follow from the check; none when it has not been run."""
    if evaluation is None:
        return []
    reported = f"{reported_accuracy:.1%}" if reported_accuracy is not None else "reported"
    limitations = [
        f"The test accuracy it reports ({reported}) could not be reproduced: on {evaluation['fights']:,} recent fights it got {evaluation['accuracy']:.0%} right.",
    ]
    if evaluation.get("confident_hit_rate") is not None:
        limitations.append(
            f"Its probabilities are overconfident: picks it rated {evaluation['confident_threshold']:.0%} or more were right about {evaluation['confident_hit_rate']:.0%} of the time."
        )
    return limitations
