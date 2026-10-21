"""The API and the trainer must share one model file, so a retrained model can never be left out of the API."""

from pathlib import Path

import joblib

from backend.app.services import prediction_service
from src.ufc_predictor import config, train


def test_the_api_loads_the_file_the_trainer_writes():
    assert prediction_service.MODEL_PATH == config.MODEL_PATH
    assert train.MODEL_PATH == config.MODEL_PATH  # train.py saves to the same constant
    assert config.MODEL_PATH.exists()


def test_there_is_no_second_copy_of_the_model_in_the_backend():
    backend = Path(__file__).resolve().parents[2] / "backend"
    copies = [path for pattern in ("*.pkl", "*.joblib") for path in backend.rglob(pattern)]
    assert copies == []


def test_the_model_file_has_what_the_api_reads_from_it():
    bundle = joblib.load(config.MODEL_PATH)
    assert {"model", "feature_columns", "metrics"} <= set(bundle)
    assert len(bundle["feature_columns"]) == prediction_service.PredictionService().model_info()["feature_count"]
