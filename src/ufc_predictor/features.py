from __future__ import annotations

import pandas as pd

from .config import DATE_COLUMN


BASE_NUMERIC_PAIRS = [
    ("age", "red_age", "blue_age"),
    ("height_cm", "red_height_cm", "blue_height_cm"),
    ("reach_cm", "red_reach_cm", "blue_reach_cm"),
    ("wins", "red_wins", "blue_wins"),
    ("losses", "red_losses", "blue_losses"),
    ("sig_str_acc", "red_sig_str_acc", "blue_sig_str_acc"),
    ("takedown_acc", "red_takedown_acc", "blue_takedown_acc"),
]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()

    for feature_name, red_col, blue_col in BASE_NUMERIC_PAIRS:
        frame[f"{feature_name}_diff"] = frame[red_col] - frame[blue_col]
        frame[f"{feature_name}_sum"] = frame[red_col] + frame[blue_col]

    frame["red_win_rate"] = frame["red_wins"] / (frame["red_wins"] + frame["red_losses"] + 1)
    frame["blue_win_rate"] = frame["blue_wins"] / (
        frame["blue_wins"] + frame["blue_losses"] + 1
    )
    frame["win_rate_diff"] = frame["red_win_rate"] - frame["blue_win_rate"]

    frame["same_stance"] = (frame["red_stance"] == frame["blue_stance"]).astype(int)

    red_stance_dummies = pd.get_dummies(frame["red_stance"], prefix="red_stance").astype(int)
    blue_stance_dummies = pd.get_dummies(frame["blue_stance"], prefix="blue_stance").astype(int)
    frame = pd.concat([frame, red_stance_dummies, blue_stance_dummies], axis=1)

    frame["fight_month"] = pd.to_datetime(frame[DATE_COLUMN]).dt.month
    frame["fight_year"] = pd.to_datetime(frame[DATE_COLUMN]).dt.year
    return frame


def get_feature_columns(df: pd.DataFrame) -> list[str]:
    ignored_columns = {
        DATE_COLUMN,
        "fighter_red",
        "fighter_blue",
        "winner",
        "red_stance",
        "blue_stance",
    }
    return [column for column in df.columns if column not in ignored_columns]


def build_inference_frame(**kwargs) -> pd.DataFrame:
    """Build a single-row dataframe and apply the same feature engineering used in training."""

    frame = pd.DataFrame([kwargs])
    enriched = build_features(frame)
    return enriched


def align_feature_columns(df: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    """Ensure inference data matches the exact training feature set."""

    aligned = df.copy()
    for column in feature_columns:
        if column not in aligned.columns:
            aligned[column] = 0
    return aligned[feature_columns]
