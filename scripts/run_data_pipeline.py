from __future__ import annotations

from scripts.build_ml_dataset import main as build_ml_dataset_main
from scripts.preprocess_ufc_data import main as preprocess_main
from scripts.scraper_ufcstats import main as scraper_main


def main() -> None:
    print("[pipeline] Step 1/3 - Scraping UFCStats raw data")
    scraper_main()

    print("\n[pipeline] Step 2/3 - Preprocessing raw data")
    preprocess_main()

    print("\n[pipeline] Step 3/3 - Building ML-ready dataset")
    build_ml_dataset_main()

    print("\n[pipeline] Data pipeline completed successfully.")
    print("[pipeline] Final artifact:")
    print(" - data/ml/ufc_ml_dataset.csv")


if __name__ == "__main__":
    main()
