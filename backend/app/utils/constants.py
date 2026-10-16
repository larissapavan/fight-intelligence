from __future__ import annotations

MODEL_NAME = "HistGradientBoostingClassifier"

MODEL_LIMITATIONS = [
    "Predictions are estimates based on past fights and each fighter's career stats.",
    "The model uses each fighter's current career numbers, not their numbers at the time of past fights.",
    "This is a personal project for learning, not betting advice.",
]

MODEL_HIGHLIGHTS = [
    "It was tested on fights that came after the ones it trained on, as a real prediction would be.",
    "Most inputs are differences between the two fighters, such as win rate, reach, age and striking accuracy.",
    "SHAP shows which stats pushed each prediction toward one fighter or the other.",
]

SYSTEM_TAGLINE = (
    "UFC fight stats, rankings and win predictions, with an explanation for every pick."
)
