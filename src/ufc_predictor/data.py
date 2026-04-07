from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import DATE_COLUMN, RAW_DATA_PATH, REQUIRED_COLUMNS, TARGET_COLUMN, ensure_directories


STANCE_VALUES = ["Orthodox", "Southpaw", "Switch", "Open Stance"]


@dataclass
class DatasetBundle:
    raw: pd.DataFrame
    modeling: pd.DataFrame


def load_or_create_dataset() -> DatasetBundle:
    ensure_directories()
    if RAW_DATA_PATH.exists():
        raw_df = pd.read_csv(RAW_DATA_PATH, parse_dates=[DATE_COLUMN])
    else:
        raw_df = generate_synthetic_dataset()
        raw_df.to_csv(RAW_DATA_PATH, index=False)

    validate_columns(raw_df)
    modeling_df = prepare_target(raw_df)
    modeling_df = modeling_df.sort_values(DATE_COLUMN).reset_index(drop=True)
    return DatasetBundle(raw=raw_df, modeling=modeling_df)


def validate_columns(df: pd.DataFrame) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(
            "Colunas obrigatorias ausentes no dataset: " + ", ".join(missing)
        )


def prepare_target(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame[DATE_COLUMN] = pd.to_datetime(frame[DATE_COLUMN], errors="coerce")
    frame = frame.dropna(subset=[DATE_COLUMN]).copy()
    normalized_winner = frame["winner"].astype(str).str.strip().str.lower()
    frame[TARGET_COLUMN] = (normalized_winner == "red").astype(int)
    return frame


def generate_synthetic_dataset(n_rows: int = 1200, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2016-01-01", periods=n_rows, freq="3D")

    red_age = rng.integers(22, 39, size=n_rows)
    blue_age = rng.integers(22, 39, size=n_rows)
    red_height = rng.normal(180, 10, size=n_rows).round(1)
    blue_height = rng.normal(179, 10, size=n_rows).round(1)
    red_reach = (red_height + rng.normal(5, 6, size=n_rows)).round(1)
    blue_reach = (blue_height + rng.normal(5, 6, size=n_rows)).round(1)
    red_wins = rng.integers(2, 26, size=n_rows)
    blue_wins = rng.integers(2, 26, size=n_rows)
    red_losses = rng.integers(0, 10, size=n_rows)
    blue_losses = rng.integers(0, 10, size=n_rows)
    red_sig = rng.uniform(0.28, 0.68, size=n_rows).round(3)
    blue_sig = rng.uniform(0.28, 0.68, size=n_rows).round(3)
    red_td = rng.uniform(0.10, 0.70, size=n_rows).round(3)
    blue_td = rng.uniform(0.10, 0.70, size=n_rows).round(3)
    red_stance = rng.choice(STANCE_VALUES, size=n_rows)
    blue_stance = rng.choice(STANCE_VALUES, size=n_rows)

    red_score = (
        0.04 * (red_wins - blue_wins)
        - 0.07 * (red_losses - blue_losses)
        + 0.03 * (red_height - blue_height)
        + 0.04 * (red_reach - blue_reach)
        + 1.3 * (red_sig - blue_sig)
        + 0.8 * (red_td - blue_td)
        - 0.03 * (red_age - blue_age)
    )
    red_prob = 1.0 / (1.0 + np.exp(-red_score))
    winner_is_red = rng.binomial(1, red_prob)

    return pd.DataFrame(
        {
            DATE_COLUMN: dates,
            "fighter_red": [f"Red Fighter {i}" for i in range(n_rows)],
            "fighter_blue": [f"Blue Fighter {i}" for i in range(n_rows)],
            "winner": np.where(winner_is_red == 1, "red", "blue"),
            "red_age": red_age,
            "blue_age": blue_age,
            "red_height_cm": red_height,
            "blue_height_cm": blue_height,
            "red_reach_cm": red_reach,
            "blue_reach_cm": blue_reach,
            "red_wins": red_wins,
            "blue_wins": blue_wins,
            "red_losses": red_losses,
            "blue_losses": blue_losses,
            "red_sig_str_acc": red_sig,
            "blue_sig_str_acc": blue_sig,
            "red_takedown_acc": red_td,
            "blue_takedown_acc": blue_td,
            "red_stance": red_stance,
            "blue_stance": blue_stance,
        }
    )
