"""Build data/raw/fight_details.csv (referee, scheduled rounds, title fight, result, result details) per fight.

The source is the Kaggle "UFC full data" CSV (UFC_full_data_silver_v2.csv), matched to our fights by fight_url.
Fights it does not cover (for example events added later from ESPN) simply have no row here.

Usage (from the repo root):
    python -m scripts.import_fight_details "path/to/UFC_full_data_silver_v2.csv"
    python -m scripts.import_fight_details SOURCE.csv --merge     # keep existing rows, add/update the ones in SOURCE
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.ufc_predictor.config import RAW_DATA_DIR

OUTPUT_PATH = RAW_DATA_DIR / "fight_details.csv"
COLUMNS = ["fight_url", "referee", "num_rounds", "title_fight", "result", "result_details"]


def build(source: Path) -> pd.DataFrame:
    raw = pd.read_csv(source, low_memory=False)
    missing = [column for column in COLUMNS if column not in raw.columns]
    if missing:
        raise SystemExit(f"{source.name} is missing columns: {missing}")
    details = raw[COLUMNS].copy()
    details["num_rounds"] = pd.to_numeric(details["num_rounds"], errors="coerce").astype("Int64")
    details["title_fight"] = details["title_fight"].map({True: "true", False: "false", "True": "true", "False": "false"})
    for column in ("fight_url", "referee", "result", "result_details"):
        details[column] = details[column].astype("string").str.strip()
    details = details[details["fight_url"].notna() & details["fight_url"].ne("")]
    return details.drop_duplicates(subset=["fight_url"], keep="last")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("source", type=Path)
    parser.add_argument("--merge", action="store_true", help="keep rows already in fight_details.csv")
    args = parser.parse_args(argv)

    details = build(args.source)
    if args.merge and OUTPUT_PATH.exists():
        old = pd.read_csv(OUTPUT_PATH, dtype=str, keep_default_na=False)
        details = pd.concat([old.astype(details.dtypes.to_dict(), errors="ignore"), details]).drop_duplicates(subset=["fight_url"], keep="last")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    details.sort_values("fight_url").to_csv(OUTPUT_PATH, index=False, encoding="utf-8", lineterminator="\r\n")
    print(f"[info] wrote {len(details)} fights to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
