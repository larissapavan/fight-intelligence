from __future__ import annotations

import logging

import joblib
import numpy as np
import pandas as pd

try:
    import shap
except ImportError:  # pragma: no cover
    shap = None

from backend.app.utils.constants import MODEL_HIGHLIGHTS, MODEL_LIMITATIONS, MODEL_NAME
from src.ufc_predictor.config import MODEL_PATH
from src.ufc_predictor.features import align_feature_columns, build_inference_frame

from .catalog_service import get_fighter_profile
from .data_confidence import assess as assess_data
from .model_evaluation import evaluation_limitations, load_recent_evaluation, metrics_note

logger = logging.getLogger(__name__)


# The one model file: the trainer writes it (src/ufc_predictor/train.py) and the API reads it, both through
# src.ufc_predictor.config.MODEL_PATH. There is no second copy to keep in sync.


# What a fighter-owned column measures, for the columns pretty_feature_name has no hand-written label for.
OWNED_FEATURE_LABELS = {
    "age": "age",
    "height_cm": "height",
    "reach_cm": "reach",
    "wins": "wins",
    "losses": "losses",
    "sig_str_acc": "striking accuracy",
    "takedown_acc": "takedown accuracy",
    "win_rate": "win rate",
}


def pretty_feature_name(feature_name: str) -> str:
    """A factor's label. There is no red or blue corner in a prediction any more (both orders are averaged), so the
    columns that belong to one fighter read "Fighter A ..." (the first one asked about) and "Fighter B ..."."""
    labels = {
        "age_diff": "Age difference",
        "height_cm_diff": "Height difference",
        "reach_cm_diff": "Reach difference",
        "wins_diff": "Wins difference",
        "losses_diff": "Losses difference",
        "sig_str_acc_diff": "Striking accuracy gap",
        "takedown_acc_diff": "Takedown accuracy gap",
        "win_rate_diff": "Win rate difference",
        "same_stance": "Same stance",
        "fight_month": "Fight month",
        "fight_year": "Fight year",
        "red_win_rate": "Fighter A win rate",
        "blue_win_rate": "Fighter B win rate",
        "red_sig_str_acc": "Fighter A striking accuracy",
        "blue_sig_str_acc": "Fighter B striking accuracy",
        "red_takedown_acc": "Fighter A takedown accuracy",
        "blue_takedown_acc": "Fighter B takedown accuracy",
    }
    if feature_name in labels:
        return labels[feature_name]
    for prefix, owner in (("red_", "Fighter A"), ("blue_", "Fighter B")):
        if feature_name.startswith(prefix):
            rest = feature_name[len(prefix):]
            if rest.startswith("stance_"):
                return f"{owner} stance: {rest[len('stance_'):]}"
            return f"{owner} {OWNED_FEATURE_LABELS.get(rest, rest.replace('_', ' '))}"
    return feature_name.replace("_", " ").title()


# Two fighters this close to 50% are a coin flip; the pick then goes to the first name alphabetically, so it does not
# depend on which fighter was typed first.
TIE_TOLERANCE = 1e-12


def _counterpart(column: str) -> str:
    """The column that holds the same fighter's value once the corners are swapped.

    red_X and blue_X trade places. Differences, sums, same_stance and the fight date are the same column in both
    orders (a difference only changes sign), so they map to themselves."""
    if column.startswith("red_"):
        return "blue_" + column[len("red_"):]
    if column.startswith("blue_"):
        return "red_" + column[len("blue_"):]
    return column


def _first_wins(probability: float, name_first: str, name_second: str) -> bool:
    if abs(probability - 0.5) < TIE_TOLERANCE:
        return name_first.lower() <= name_second.lower()
    return probability > 0.5


class PredictionService:
    def __init__(self) -> None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model artifact not found at {MODEL_PATH}. Restore models/ufc_winner_model.joblib from the repository, "
                "or write a new one with python -m src.ufc_predictor.train."
            )

        bundle = joblib.load(MODEL_PATH)
        self.model = bundle["model"]
        self.feature_columns: list[str] = bundle["feature_columns"]
        self.metrics: dict = bundle.get("metrics", {})
        self.baseline_metrics: dict = bundle.get("baseline_metrics", {})
        self.shap_background = bundle.get("shap_background")
        self.recent_evaluation = load_recent_evaluation()
        self.shap_explainer = self._build_shap_explainer()
        # Position of each feature's counterpart under a corner swap (see _counterpart).
        self._counterpart_index = [self.feature_columns.index(_counterpart(column)) for column in self.feature_columns]

    def _build_shap_explainer(self):
        if shap is None:
            logger.warning("shap is not installed; main_factors will be empty on every prediction.")
            return None
        if self.shap_background is None or len(self.shap_background) == 0:
            logger.warning("No shap_background in model bundle; main_factors will be empty on every prediction.")
            return None

        background = self.shap_background[self.feature_columns].copy()
        imputed_background = self.model.named_steps["imputer"].transform(background)
        classifier = self.model.named_steps["classifier"]

        return shap.TreeExplainer(
            classifier,
            imputed_background,
            feature_names=self.feature_columns,
            model_output="probability",
        )

    def _features_for(self, fighter_a: dict, fighter_b: dict) -> pd.DataFrame:
        inference_df = build_inference_frame(
            fight_date=pd.Timestamp.today().normalize(),
            fighter_red=fighter_a["name"],
            fighter_blue=fighter_b["name"],
            red_age=_model_number(fighter_a["age"], default=30.0),
            blue_age=_model_number(fighter_b["age"], default=30.0),
            red_height_cm=_model_number(fighter_a["height_cm"], default=178.0),
            blue_height_cm=_model_number(fighter_b["height_cm"], default=178.0),
            red_reach_cm=_model_number(fighter_a["reach_cm"], default=183.0),
            blue_reach_cm=_model_number(fighter_b["reach_cm"], default=183.0),
            red_wins=fighter_a["wins"],
            blue_wins=fighter_b["wins"],
            red_losses=fighter_a["losses"],
            blue_losses=fighter_b["losses"],
            red_sig_str_acc=_model_number(fighter_a["sig_str_acc"], default=0.45),
            blue_sig_str_acc=_model_number(fighter_b["sig_str_acc"], default=0.45),
            red_takedown_acc=_model_number(fighter_a["takedown_acc"], default=0.40),
            blue_takedown_acc=_model_number(fighter_b["takedown_acc"], default=0.40),
            red_stance=fighter_a["stance"],
            blue_stance=fighter_b["stance"],
        )
        return align_feature_columns(inference_df, self.feature_columns)

    def _both_orders(self, fighter_a: dict, fighter_b: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
        return self._features_for(fighter_a, fighter_b), self._features_for(fighter_b, fighter_a)

    def _symmetric_probability(self, x_ab: pd.DataFrame, x_ba: pd.DataFrame) -> float:
        """Chance that the first fighter wins, the same whichever fighter is typed first.

        The model learned that the red corner wins more often (56.4% of its training fights), so asking it about
        (A, B) and (B, A) gives answers that do not add up to 100%. Averaging "A as red wins" with "B as red loses"
        cancels that corner bias: p(A, B) + p(B, A) is exactly 1."""
        probabilities = self.model.predict_proba(pd.concat([x_ab, x_ba], ignore_index=True))[:, 1]
        return (float(probabilities[0]) + 1.0 - float(probabilities[1])) / 2.0

    def predict_pick(self, fighter_a_name: str, fighter_b_name: str) -> dict:
        """Just the pick and its probability (no SHAP), for lists that show many fights at once."""
        fighter_a = get_fighter_profile(fighter_a_name)
        fighter_b = get_fighter_profile(fighter_b_name)
        fighter_a_probability = self._symmetric_probability(*self._both_orders(fighter_a, fighter_b))
        winner_is_a = _first_wins(fighter_a_probability, fighter_a["name"], fighter_b["name"])
        return {
            "predicted_winner": fighter_a["name"] if winner_is_a else fighter_b["name"],
            "probability": max(fighter_a_probability, 1.0 - fighter_a_probability),
            "fighter_a_probability": fighter_a_probability,
        }

    def division_matrix(self, category: str, entries: list[dict]) -> dict:
        """Each ranked fighter against each other one (pick only, no SHAP), and the round-robin standings that follow.

        entries are the ranking rows in order (champion first). The standings are the average chance of beating the
        rest and the sum of those chances (expected wins); they say who the model likes in a division as a whole, not
        who would win a tournament, because no bracket is simulated."""
        profiles, skipped = [], []
        for entry in entries:
            try:
                profiles.append((entry, get_fighter_profile(entry["fighter"])))
            except KeyError:
                skipped.append(entry["fighter"])
        size = len(profiles)
        matrix: list[list[float | None]] = [[None] * size for _ in range(size)]
        for i in range(size):
            for j in range(i + 1, size):
                p = self._symmetric_probability(*self._both_orders(profiles[i][1], profiles[j][1]))
                matrix[i][j], matrix[j][i] = p, 1.0 - p
        rows = []
        for i, (entry, profile) in enumerate(profiles):
            chances = [p for p in matrix[i] if p is not None]
            rows.append(
                {
                    "fighter": profile["name"],
                    "rank": int(entry["rank"]),
                    "average_win_probability": sum(chances) / len(chances) if chances else 0.0,
                    "expected_wins": sum(chances),
                }
            )
        rows.sort(key=lambda row: (-row["average_win_probability"], row["rank"]))
        return {
            "category": category,
            "fighters": [profile["name"] for _, profile in profiles],
            "matrix": matrix,
            "round_robin": rows,
            "skipped": skipped,
        }

    def predict_matchup(self, fighter_a_name: str, fighter_b_name: str) -> dict:
        fighter_a = get_fighter_profile(fighter_a_name)
        fighter_b = get_fighter_profile(fighter_b_name)

        x_ab, x_ba = self._both_orders(fighter_a, fighter_b)
        fighter_a_probability = self._symmetric_probability(x_ab, x_ba)
        fighter_b_probability = 1.0 - fighter_a_probability
        predicted_winner = (
            fighter_a["name"]
            if _first_wins(fighter_a_probability, fighter_a["name"], fighter_b["name"])
            else fighter_b["name"]
        )
        probability = max(fighter_a_probability, fighter_b_probability)

        main_factors = self._build_main_factors(x_ab, x_ba, fighter_a["name"], fighter_b["name"])

        return {
            "predicted_winner": predicted_winner,
            "probability": probability,
            "fighter_a_probability": fighter_a_probability,
            "fighter_b_probability": fighter_b_probability,
            "message": self._build_message(predicted_winner, probability),
            "fighter_a_profile": fighter_a,
            "fighter_b_profile": fighter_b,
            "comparison_stats": self._build_comparison(fighter_a, fighter_b),
            "main_factors": main_factors,
            "data_confidence": assess_data(fighter_a, fighter_b),
        }

    def model_info(self) -> dict:
        return {
            "model_name": MODEL_NAME,
            "feature_count": len(self.feature_columns),
            "metrics": self.metrics,
            "baseline_metrics": self.baseline_metrics,
            "features": self.feature_columns,
            "highlights": MODEL_HIGHLIGHTS,
            # the closing "not betting advice" line stays last, after what the re-check found
            "limitations": [
                *MODEL_LIMITATIONS[:-1],
                *evaluation_limitations(self.recent_evaluation, self.metrics.get("accuracy")),
                *MODEL_LIMITATIONS[-1:],
            ],
            "metrics_note": metrics_note(self.recent_evaluation, self.metrics.get("accuracy")),
            "recent_evaluation": self.recent_evaluation,
        }

    def _combined_attributions(self, x_ab: pd.DataFrame, x_ba: pd.DataFrame) -> np.ndarray | None:
        """Each feature's push toward the first fighter, from both orders (one value per feature column).

        SHAP explains p(A as red) from (A, B) and p(B as red) from (B, A). A feature that belongs to a fighter sits in
        a different column in each order, so the two explanations are lined up through _counterpart, and the second
        one is negated because it points toward B. The attributions then add up to p(A) - 0.5: the baseline is a
        coin flip, not the red-corner win rate the raw model starts from. They add up only approximately, as far as
        SHAP itself does: its probability output is off by up to about 1 percentage point per order."""
        if self.shap_explainer is None:
            return None
        imputed = self.model.named_steps["imputer"].transform(pd.concat([x_ab, x_ba], ignore_index=True))
        values = self.shap_explainer(imputed).values
        return 0.5 * (values[0] - values[1][self._counterpart_index])

    def _build_main_factors(
        self, x_ab: pd.DataFrame, x_ba: pd.DataFrame, fighter_a_name: str, fighter_b_name: str
    ) -> list[dict]:
        """The six features that moved the pick the most, explained with the same two-order average as the probability."""
        combined = self._combined_attributions(x_ab, x_ba)
        if combined is None:
            return []

        contributions = pd.DataFrame({"feature": self.feature_columns, "shap_value": combined})
        contributions["feature"] = contributions["feature"].map(pretty_feature_name)
        top_contributions = contributions.reindex(
            contributions["shap_value"].abs().sort_values(ascending=False).index
        ).head(6)

        factors: list[dict] = []
        for _, row in top_contributions.iterrows():
            toward = fighter_a_name if row["shap_value"] >= 0 else fighter_b_name
            factors.append(
                {
                    "feature": row["feature"],
                    "impact": toward,
                    "explanation": f"{row['feature']} pushed the prediction toward {toward}.",
                    "magnitude": float(abs(row["shap_value"])),
                }
            )
        return factors

    def _build_comparison(self, fighter_a: dict, fighter_b: dict) -> dict:
        age_a = fighter_a["age"] or 0
        age_b = fighter_b["age"] or 0
        reach_a = fighter_a["reach_cm"] or 0
        reach_b = fighter_b["reach_cm"] or 0
        return {
            "fighter_a_win_rate": fighter_a["win_rate"],
            "fighter_b_win_rate": fighter_b["win_rate"],
            "reach_difference": round(reach_a - reach_b, 2),
            "age_difference": round(age_a - age_b, 2),
        }

    def _build_message(self, predicted_winner: str, probability: float) -> str:
        confidence = "strong" if probability >= 0.7 else "moderate" if probability >= 0.58 else "competitive"
        return f"The model gives {predicted_winner} a {confidence} edge in this matchup."


def _model_number(value, default: float = 0.0) -> float:
    return default if value is None or pd.isna(value) else float(value)
