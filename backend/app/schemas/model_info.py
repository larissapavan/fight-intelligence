from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    fighters_loaded: int
    fights_tracked: int
    latest_fight_date: str | None = None


class BaselineRule(BaseModel):
    label: str
    accuracy: float


class CalibrationBin(BaseModel):
    label: str
    fights: int
    average_confidence: float
    accuracy: float


class RecentEvaluation(BaseModel):
    """The deployed model scored again on the newest fights (see scripts/compare_models.py)."""

    fights: int
    start: str
    end: str
    accuracy: float
    roc_auc: float
    log_loss: float
    brier: float | None = None
    ece: float | None = None
    confident_threshold: float | None = None
    confident_fights: int | None = None
    confident_hit_rate: float | None = None
    baselines: list[BaselineRule] = []
    calibration: list[CalibrationBin] = []


class ModelInfoResponse(BaseModel):
    model_name: str
    feature_count: int
    metrics: dict
    baseline_metrics: dict
    features: list[str]
    highlights: list[str]
    limitations: list[str]
    metrics_note: str | None = None
    recent_evaluation: RecentEvaluation | None = None
