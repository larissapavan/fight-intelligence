from __future__ import annotations

import logging
from pathlib import Path

import joblib
import pandas as pd

try:
    import shap
except ImportError:  # pragma: no cover
    shap = None

from src.ufc_predictor.features import align_feature_columns, build_inference_frame

from .catalog_service import get_fighter_profile
from backend.app.utils.constants import MODEL_HIGHLIGHTS, MODEL_LIMITATIONS, MODEL_NAME

logger = logging.getLogger(__name__)


BACKEND_MODEL_PATH = Path(__file__).resolve().parents[2] / "model" / "model.pkl"


def pretty_feature_name(feature_name: str) -> str:
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
    return labels.get(feature_name, feature_name.replace("_", " ").title())


class PredictionService:
    def __init__(self) -> None:
        if not BACKEND_MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Backend model artifact not found at {BACKEND_MODEL_PATH}. "
                "Copy the trained artifact into backend/model/model.pkl."
            )

        bundle = joblib.load(BACKEND_MODEL_PATH)
        self.model = bundle["model"]
        self.feature_columns: list[str] = bundle["feature_columns"]
        self.metrics: dict = bundle.get("metrics", {})
        self.baseline_metrics: dict = bundle.get("baseline_metrics", {})
        self.shap_background = bundle.get("shap_background")
        self.shap_explainer = self._build_shap_explainer()

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

    def predict_matchup(self, fighter_a_name: str, fighter_b_name: str) -> dict:
        fighter_a = get_fighter_profile(fighter_a_name)
        fighter_b = get_fighter_profile(fighter_b_name)

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
        X = align_feature_columns(inference_df, self.feature_columns)
        fighter_a_probability = float(self.model.predict_proba(X)[0, 1])
        fighter_b_probability = 1.0 - fighter_a_probability
        predicted_winner = (
            fighter_a["name"] if fighter_a_probability >= fighter_b_probability else fighter_b["name"]
        )
        probability = max(fighter_a_probability, fighter_b_probability)

        main_factors = self._build_main_factors(X, fighter_a["name"], fighter_b["name"])

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
        }

    def model_info(self) -> dict:
        return {
            "model_name": MODEL_NAME,
            "feature_count": len(self.feature_columns),
            "metrics": self.metrics,
            "baseline_metrics": self.baseline_metrics,
            "features": self.feature_columns,
            "highlights": MODEL_HIGHLIGHTS,
            "limitations": MODEL_LIMITATIONS,
        }

    def _build_main_factors(self, features: pd.DataFrame, fighter_a_name: str, fighter_b_name: str) -> list[dict]:
        if self.shap_explainer is None:
            return []

        imputed_features = self.model.named_steps["imputer"].transform(features)
        shap_values = self.shap_explainer(imputed_features)
        contributions = pd.DataFrame(
            {
                "feature": self.feature_columns,
                "shap_value": shap_values.values[0],
            }
        )
        contributions["feature"] = contributions["feature"].map(pretty_feature_name)
        top_contributions = contributions.reindex(
            contributions["shap_value"].abs().sort_values(ascending=False).index
        ).head(5)

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
