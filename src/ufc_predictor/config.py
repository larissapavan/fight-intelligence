from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODEL_DIR = BASE_DIR / "models"
REPORT_DIR = BASE_DIR / "reports"

RAW_DATA_PATH = RAW_DATA_DIR / "ufc_fights.csv"
KAGGLE_UFC_DATA_PATH = RAW_DATA_DIR / "UFC.csv"
PROCESSED_DATA_PATH = PROCESSED_DATA_DIR / "modeling_dataset.csv"
MODEL_PATH = MODEL_DIR / "ufc_winner_model.joblib"
REPORT_PATH = REPORT_DIR / "training_report.txt"

EXTERNAL_KAGGLE_FILES = {
    "event_details": RAW_DATA_DIR / "event_details.csv",
    "fight_details": RAW_DATA_DIR / "fight_details.csv",
    "fighter_details": RAW_DATA_DIR / "fighter_details.csv",
    "ufc": RAW_DATA_DIR / "UFC.csv",
}

TARGET_COLUMN = "target_red_win"
DATE_COLUMN = "fight_date"

REQUIRED_COLUMNS = [
    DATE_COLUMN,
    "fighter_red",
    "fighter_blue",
    "winner",
    "red_age",
    "blue_age",
    "red_height_cm",
    "blue_height_cm",
    "red_reach_cm",
    "blue_reach_cm",
    "red_wins",
    "blue_wins",
    "red_losses",
    "blue_losses",
    "red_sig_str_acc",
    "blue_sig_str_acc",
    "red_takedown_acc",
    "blue_takedown_acc",
    "red_stance",
    "blue_stance",
]


def ensure_directories() -> None:
    for path in [RAW_DATA_DIR, PROCESSED_DATA_DIR, MODEL_DIR, REPORT_DIR]:
        path.mkdir(parents=True, exist_ok=True)
