from __future__ import annotations

MODEL_NAME = "HistGradientBoostingClassifier"

MODEL_LIMITATIONS = [
    "Predictions are estimative and based on historical pre-fight data.",
    "The current dataset can still be improved with fully reconstructed rolling fighter statistics.",
    "This system is intended for portfolio and analysis purposes, not betting advice.",
]

MODEL_HIGHLIGHTS = [
    "Temporal validation is used instead of random split to better simulate real prediction flow.",
    "Feature engineering emphasizes matchup deltas such as win rate, reach, age, and striking efficiency.",
    "SHAP explanations are used to translate model output into a readable fight analysis view.",
]

SYSTEM_TAGLINE = (
    "Professional fight intelligence platform for predictive analysis, athlete comparison, and explainable ML insights."
)
