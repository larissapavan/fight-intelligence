from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


RAW_DATA_DIR = Path("data") / "raw"
PROCESSED_DATA_DIR = Path("data") / "processed"

EVENTS_RAW_PATH = RAW_DATA_DIR / "events.csv"
FIGHTS_RAW_PATH = RAW_DATA_DIR / "fights.csv"
FIGHTERS_RAW_PATH = RAW_DATA_DIR / "fighters.csv"

EVENTS_CLEAN_PATH = PROCESSED_DATA_DIR / "events_clean.csv"
FIGHTS_CLEAN_PATH = PROCESSED_DATA_DIR / "fights_clean.csv"
FIGHTERS_CLEAN_PATH = PROCESSED_DATA_DIR / "fighters_clean.csv"


def ensure_processed_directory() -> None:
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Required input file not found: {path}")
    return pd.read_csv(path)


def normalize_column_name(name: str) -> str:
    normalized = name.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    return normalized.strip("_")


def standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {column: normalize_column_name(column) for column in df.columns}
    return df.rename(columns=renamed)


def strip_object_columns(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()
    object_columns = cleaned.select_dtypes(include=["object"]).columns

    for column in object_columns:
        cleaned[column] = cleaned[column].apply(clean_string_value)

    return cleaned


def clean_string_value(value):
    if pd.isna(value):
        return None
    if not isinstance(value, str):
        return value

    compact = " ".join(value.split()).strip()
    return compact or None


def parse_date_series(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def parse_numeric_series(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def parse_height_to_cm(value) -> float | None:
    text = clean_string_value(value)
    if text is None:
        return None

    feet_inches_match = re.match(r"^(\d+)\s*'\s*(\d+)\s*\"?$", text)
    if feet_inches_match:
        feet = int(feet_inches_match.group(1))
        inches = int(feet_inches_match.group(2))
        return round((feet * 12 + inches) * 2.54, 2)

    if "cm" in text.lower():
        number = parse_first_number(text)
        return round(number, 2) if number is not None else None

    return None


def parse_weight_to_lbs(value) -> float | None:
    text = clean_string_value(value)
    if text is None:
        return None

    number = parse_first_number(text)
    return round(number, 2) if number is not None else None


def parse_reach_to_cm(value) -> float | None:
    text = clean_string_value(value)
    if text is None:
        return None

    if "cm" in text.lower():
        number = parse_first_number(text)
        return round(number, 2) if number is not None else None

    number = parse_first_number(text)
    if number is None:
        return None

    return round(number * 2.54, 2)


def parse_first_number(text: str) -> float | None:
    match = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", "."))
    if not match:
        return None
    return float(match.group(1))


def fill_missing_strings(df: pd.DataFrame, columns: list[str], fill_value: str = "Unknown") -> pd.DataFrame:
    cleaned = df.copy()
    for column in columns:
        if column in cleaned.columns:
            cleaned[column] = cleaned[column].fillna(fill_value)
    return cleaned


def preprocess_events(events_df: pd.DataFrame) -> pd.DataFrame:
    cleaned = standardize_columns(events_df)
    cleaned = strip_object_columns(cleaned)

    if "event_date" in cleaned.columns:
        cleaned["event_date"] = parse_date_series(cleaned["event_date"])

    cleaned = fill_missing_strings(cleaned, ["event_name", "event_url"], fill_value="Unknown")
    cleaned = cleaned.drop_duplicates(subset=["event_url"]).sort_values("event_date", na_position="last")
    return cleaned.reset_index(drop=True)


def preprocess_fights(fights_df: pd.DataFrame) -> pd.DataFrame:
    cleaned = standardize_columns(fights_df)
    cleaned = strip_object_columns(cleaned)

    if "event_date" in cleaned.columns:
        cleaned["event_date"] = parse_date_series(cleaned["event_date"])

    for numeric_column in ["round"]:
        if numeric_column in cleaned.columns:
            cleaned[numeric_column] = parse_numeric_series(cleaned[numeric_column])

    cleaned = fill_missing_strings(
        cleaned,
        ["event_name", "fight_url", "fighter_1", "fighter_2", "weight_class", "method", "time"],
        fill_value="Unknown",
    )
    cleaned = cleaned.drop_duplicates(subset=["fight_url"]).sort_values("event_date", na_position="last")
    return cleaned.reset_index(drop=True)


def preprocess_fighters(fighters_df: pd.DataFrame) -> pd.DataFrame:
    cleaned = standardize_columns(fighters_df)
    cleaned = strip_object_columns(cleaned)

    if {"first_name", "last_name"}.issubset(cleaned.columns):
        cleaned["full_name"] = (
            cleaned["first_name"].fillna("").astype(str).str.strip() + " " + cleaned["last_name"].fillna("").astype(str).str.strip()
        ).str.strip()
        cleaned["full_name"] = cleaned["full_name"].replace("", pd.NA)

    for numeric_column in ["wins", "losses", "draws"]:
        if numeric_column in cleaned.columns:
            cleaned[numeric_column] = parse_numeric_series(cleaned[numeric_column]).fillna(0).astype("Int64")

    if "height" in cleaned.columns:
        cleaned["height_cm"] = cleaned["height"].apply(parse_height_to_cm)
    if "weight" in cleaned.columns:
        cleaned["weight_lbs"] = cleaned["weight"].apply(parse_weight_to_lbs)
    if "reach" in cleaned.columns:
        cleaned["reach_cm"] = cleaned["reach"].apply(parse_reach_to_cm)

    cleaned = fill_missing_strings(
        cleaned,
        ["first_name", "last_name", "nickname", "stance", "belt", "fighter_url"],
        fill_value="Unknown",
    )
    if "full_name" in cleaned.columns:
        cleaned["full_name"] = cleaned["full_name"].fillna("Unknown")

    cleaned = cleaned.drop_duplicates(subset=["fighter_url"]).sort_values("full_name", na_position="last")
    return cleaned.reset_index(drop=True)


def save_clean_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False, encoding="utf-8-sig")


def main() -> None:
    ensure_processed_directory()

    print("[info] Loading raw UFCStats files...")
    events_df = load_csv(EVENTS_RAW_PATH)
    fights_df = load_csv(FIGHTS_RAW_PATH)
    fighters_df = load_csv(FIGHTERS_RAW_PATH)

    print("[info] Cleaning events...")
    events_clean = preprocess_events(events_df)
    save_clean_csv(events_clean, EVENTS_CLEAN_PATH)

    print("[info] Cleaning fights...")
    fights_clean = preprocess_fights(fights_df)
    save_clean_csv(fights_clean, FIGHTS_CLEAN_PATH)

    print("[info] Cleaning fighters...")
    fighters_clean = preprocess_fighters(fighters_df)
    save_clean_csv(fighters_clean, FIGHTERS_CLEAN_PATH)

    print("[info] Preprocessing completed successfully.")
    print("[info] Generated files:")
    print(" - data/processed/events_clean.csv")
    print(" - data/processed/fights_clean.csv")
    print(" - data/processed/fighters_clean.csv")


if __name__ == "__main__":
    main()
