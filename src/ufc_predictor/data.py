"""Training-data loading for the UFC winner model.

KNOWN LIMITATION (data provenance): the model currently deployed at
backend/model/model.pkl was trained on a Kaggle-style dataset
(data/raw/ufc_fights.csv or data/raw/UFC.csv) that is NOT checked into this
repository, so `python -m src.ufc_predictor.train` cannot reproduce it today.
If neither file is present, load_or_create_dataset() falls back to
generate_synthetic_dataset() below, which is randomly generated and NOT
representative of real fights.

data/raw/{fighters,fights,fighter_career_stats}.csv (populated by
scripts/scraper_ufcstats.py and scripts/scrape_fighter_career_stats.py) are
real, comprehensive, and used to power the live fighter catalog and
inference-time features. They are NOT yet wired into this training pipeline:
fights.csv has no declared winner and no point-in-time fighter stats, so
building a leakage-free training set from it (per-fight snapshots rather than
each fighter's current career totals) is a separate, non-trivial project
of its own, not attempted here.
"""

from __future__ import annotations

from dataclasses import dataclass
import shutil

import numpy as np
import pandas as pd

from .config import (
    DATE_COLUMN,
    EXTERNAL_KAGGLE_FILES,
    KAGGLE_UFC_DATA_PATH,
    RAW_DATA_PATH,
    REQUIRED_COLUMNS,
    TARGET_COLUMN,
    ensure_directories,
)


STANCE_VALUES = ["Orthodox", "Southpaw", "Switch", "Open Stance"]


@dataclass
class DatasetBundle:
    raw: pd.DataFrame
    modeling: pd.DataFrame


def load_or_create_dataset() -> DatasetBundle:
    ensure_directories()
    raw_df = load_standardized_dataset()
    if raw_df is None:
        kaggle_df = load_kaggle_dataset()
        if kaggle_df is not None:
            raw_df = transform_kaggle_dataset(kaggle_df)
            raw_df.to_csv(RAW_DATA_PATH, index=False)
        else:
            raw_df = generate_synthetic_dataset()
            raw_df.to_csv(RAW_DATA_PATH, index=False)

    validate_columns(raw_df)
    modeling_df = prepare_target(raw_df)
    modeling_df = modeling_df.sort_values(DATE_COLUMN).reset_index(drop=True)
    return DatasetBundle(raw=raw_df, modeling=modeling_df)


def load_standardized_dataset() -> pd.DataFrame | None:
    if not RAW_DATA_PATH.exists():
        return None
    df = pd.read_csv(RAW_DATA_PATH, parse_dates=[DATE_COLUMN])
    return df if all(column in df.columns for column in REQUIRED_COLUMNS) else None


def load_kaggle_dataset() -> pd.DataFrame | None:
    candidate_paths = [KAGGLE_UFC_DATA_PATH, EXTERNAL_KAGGLE_FILES["ufc"]]
    for source_path in candidate_paths:
        if source_path.exists():
            if source_path != KAGGLE_UFC_DATA_PATH:
                shutil.copy2(source_path, KAGGLE_UFC_DATA_PATH)
            return pd.read_csv(source_path)
    return None


def validate_columns(df: pd.DataFrame) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(
            "Required columns missing from dataset: " + ", ".join(missing)
        )


def prepare_target(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame[DATE_COLUMN] = pd.to_datetime(frame[DATE_COLUMN], errors="coerce")
    frame = frame.dropna(subset=[DATE_COLUMN]).copy()
    normalized_winner = frame["winner"].astype(str).str.strip().str.lower()
    frame[TARGET_COLUMN] = (normalized_winner == "red").astype(int)
    return frame


def transform_kaggle_dataset(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    fight_dates = pd.to_datetime(frame["date"], errors="coerce")
    red_dob = pd.to_datetime(frame["r_dob"], errors="coerce")
    blue_dob = pd.to_datetime(frame["b_dob"], errors="coerce")

    transformed = pd.DataFrame(
        {
            DATE_COLUMN: fight_dates,
            "fighter_red": frame["r_name"],
            "fighter_blue": frame["b_name"],
            "winner": infer_corner_winner(frame),
            "red_age": compute_age(fight_dates, red_dob),
            "blue_age": compute_age(fight_dates, blue_dob),
            "red_height_cm": pd.to_numeric(frame["r_height"], errors="coerce"),
            "blue_height_cm": pd.to_numeric(frame["b_height"], errors="coerce"),
            "red_reach_cm": pd.to_numeric(frame["r_reach"], errors="coerce"),
            "blue_reach_cm": pd.to_numeric(frame["b_reach"], errors="coerce"),
            "red_wins": pd.to_numeric(frame["r_wins"], errors="coerce"),
            "blue_wins": pd.to_numeric(frame["b_wins"], errors="coerce"),
            "red_losses": pd.to_numeric(frame["r_losses"], errors="coerce"),
            "blue_losses": pd.to_numeric(frame["b_losses"], errors="coerce"),
            "red_sig_str_acc": normalize_percent_column(frame["r_str_acc"]),
            "blue_sig_str_acc": normalize_percent_column(frame["b_str_acc"]),
            "red_takedown_acc": normalize_percent_column(frame["r_td_avg_acc"]),
            "blue_takedown_acc": normalize_percent_column(frame["b_td_avg_acc"]),
            "red_stance": frame["r_stance"].fillna("Unknown"),
            "blue_stance": frame["b_stance"].fillna("Unknown"),
        }
    )
    return transformed.dropna(subset=[DATE_COLUMN, "winner"]).reset_index(drop=True)


def infer_corner_winner(df: pd.DataFrame) -> pd.Series:
    winner_id = df["winner_id"].astype(str)
    red_id = df["r_id"].astype(str)
    blue_id = df["b_id"].astype(str)
    winner_name = df["winner"].astype(str).str.strip()
    red_name = df["r_name"].astype(str).str.strip()
    blue_name = df["b_name"].astype(str).str.strip()

    return pd.Series(
        np.select(
            [
                winner_id.eq(red_id) | winner_name.eq(red_name),
                winner_id.eq(blue_id) | winner_name.eq(blue_name),
            ],
            ["red", "blue"],
            default=None,
        ),
        index=df.index,
    )


def compute_age(fight_date: pd.Series, dob: pd.Series) -> pd.Series:
    age_days = (fight_date - dob).dt.days
    return (age_days / 365.25).round(2)


def normalize_percent_column(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.where(numeric <= 1, numeric / 100.0)


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
