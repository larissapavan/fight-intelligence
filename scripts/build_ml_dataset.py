from __future__ import annotations

from pathlib import Path

import pandas as pd


PROCESSED_DATA_DIR = Path("data") / "processed"
ML_DATA_DIR = Path("data") / "ml"

FIGHTS_CLEAN_PATH = PROCESSED_DATA_DIR / "fights_clean.csv"
FIGHTERS_CLEAN_PATH = PROCESSED_DATA_DIR / "fighters_clean.csv"
OUTPUT_PATH = ML_DATA_DIR / "ufc_ml_dataset.csv"


def ensure_ml_directory() -> None:
    ML_DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Required input file not found: {path}")
    return pd.read_csv(path)


def clean_name(value) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def add_fighter_metrics(fighters_df: pd.DataFrame) -> pd.DataFrame:
    enriched = fighters_df.copy()

    for column in ["wins", "losses", "draws", "height_cm", "reach_cm", "weight_lbs"]:
        if column in enriched.columns:
            enriched[column] = pd.to_numeric(enriched[column], errors="coerce")

    wins = enriched["wins"] if "wins" in enriched.columns else 0
    losses = enriched["losses"] if "losses" in enriched.columns else 0
    draws = enriched["draws"] if "draws" in enriched.columns else 0

    enriched["experience"] = wins.fillna(0) + losses.fillna(0) + draws.fillna(0)
    denominator = wins.fillna(0) + losses.fillna(0) + draws.fillna(0)
    enriched["win_rate"] = wins.fillna(0).div(denominator.where(denominator > 0))

    if "full_name" in enriched.columns:
        enriched["full_name"] = enriched["full_name"].apply(clean_name)

    return enriched


def prepare_fights(fights_df: pd.DataFrame) -> pd.DataFrame:
    prepared = fights_df.copy()

    if "event_date" in prepared.columns:
        prepared["event_date"] = pd.to_datetime(prepared["event_date"], errors="coerce")

    for column in ["fighter_1", "fighter_2", "winner"]:
        if column in prepared.columns:
            prepared[column] = prepared[column].apply(clean_name)

    return prepared


def merge_fighter_profiles(fights_df: pd.DataFrame, fighters_df: pd.DataFrame) -> pd.DataFrame:
    fighter_features = [
        "full_name",
        "height_cm",
        "reach_cm",
        "weight_lbs",
        "wins",
        "losses",
        "draws",
        "experience",
        "win_rate",
    ]

    age_column = find_age_column(fighters_df)
    if age_column:
        fighter_features.append(age_column)

    fighter_lookup = fighters_df[fighter_features].copy()

    fighter_1_lookup = fighter_lookup.rename(
        columns={column: f"fighter_1_{column}" for column in fighter_lookup.columns if column != "full_name"}
    )
    fighter_2_lookup = fighter_lookup.rename(
        columns={column: f"fighter_2_{column}" for column in fighter_lookup.columns if column != "full_name"}
    )

    merged = fights_df.merge(
        fighter_1_lookup,
        left_on="fighter_1",
        right_on="full_name",
        how="left",
    ).drop(columns=["full_name"])

    merged = merged.merge(
        fighter_2_lookup,
        left_on="fighter_2",
        right_on="full_name",
        how="left",
    ).drop(columns=["full_name"])

    return merged


def find_age_column(fighters_df: pd.DataFrame) -> str | None:
    for candidate in ["age", "age_years"]:
        if candidate in fighters_df.columns:
            return candidate
    return None


def infer_target(row: pd.Series) -> float | None:
    winner = clean_name(row.get("winner"))
    fighter_1 = clean_name(row.get("fighter_1"))
    fighter_2 = clean_name(row.get("fighter_2"))

    if winner is None or fighter_1 is None or fighter_2 is None:
        return None

    if winner == fighter_1:
        return 1.0
    if winner == fighter_2:
        return 0.0

    winner_lower = winner.lower()
    fighter_1_lower = fighter_1.lower()
    fighter_2_lower = fighter_2.lower()

    if winner_lower == fighter_1_lower:
        return 1.0
    if winner_lower == fighter_2_lower:
        return 0.0

    return None


def build_feature_columns(merged_df: pd.DataFrame) -> pd.DataFrame:
    dataset = merged_df.copy()

    dataset["reach_diff"] = dataset["fighter_1_reach_cm"] - dataset["fighter_2_reach_cm"]
    dataset["height_diff"] = dataset["fighter_1_height_cm"] - dataset["fighter_2_height_cm"]
    dataset["win_rate_diff"] = dataset["fighter_1_win_rate"] - dataset["fighter_2_win_rate"]
    dataset["experience_diff"] = dataset["fighter_1_experience"] - dataset["fighter_2_experience"]

    fighter_1_age_col = next((col for col in dataset.columns if col.startswith("fighter_1_age")), None)
    fighter_2_age_col = next((col for col in dataset.columns if col.startswith("fighter_2_age")), None)

    if fighter_1_age_col and fighter_2_age_col:
        dataset["age_diff"] = pd.to_numeric(dataset[fighter_1_age_col], errors="coerce") - pd.to_numeric(
            dataset[fighter_2_age_col],
            errors="coerce",
        )
    else:
        dataset["age_diff"] = pd.NA

    dataset["target"] = dataset.apply(infer_target, axis=1)
    return dataset


def finalize_dataset(dataset: pd.DataFrame) -> pd.DataFrame:
    selected_columns = [
        "event_name",
        "event_date",
        "fight_url",
        "fighter_1",
        "fighter_2",
        "winner",
        "weight_class",
        "method",
        "round",
        "time",
        "fighter_1_height_cm",
        "fighter_2_height_cm",
        "fighter_1_reach_cm",
        "fighter_2_reach_cm",
        "fighter_1_wins",
        "fighter_2_wins",
        "fighter_1_losses",
        "fighter_2_losses",
        "fighter_1_experience",
        "fighter_2_experience",
        "fighter_1_win_rate",
        "fighter_2_win_rate",
        "reach_diff",
        "height_diff",
        "win_rate_diff",
        "experience_diff",
        "age_diff",
        "target",
    ]

    existing_columns = [column for column in selected_columns if column in dataset.columns]
    final_df = dataset[existing_columns].copy()
    final_df = final_df.drop_duplicates(subset=["fight_url"])
    final_df = final_df.sort_values("event_date", na_position="last").reset_index(drop=True)
    return final_df


def save_ml_dataset(df: pd.DataFrame) -> None:
    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")


def main() -> None:
    ensure_ml_directory()

    print("[info] Loading processed UFC data...")
    fights_df = prepare_fights(load_csv(FIGHTS_CLEAN_PATH))
    fighters_df = add_fighter_metrics(load_csv(FIGHTERS_CLEAN_PATH))

    print("[info] Merging fighter profiles into fights...")
    merged_df = merge_fighter_profiles(fights_df, fighters_df)

    print("[info] Building ML features...")
    dataset = build_feature_columns(merged_df)
    final_df = finalize_dataset(dataset)
    save_ml_dataset(final_df)

    print("[info] ML dataset created successfully.")
    print(f"[info] Rows saved: {len(final_df)}")
    print("[info] Generated file:")
    print(" - data/ml/ufc_ml_dataset.csv")


if __name__ == "__main__":
    main()
