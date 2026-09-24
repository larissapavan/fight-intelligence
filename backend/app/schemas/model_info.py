from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    fighters_loaded: int
    fights_tracked: int


class ModelInfoResponse(BaseModel):
    model_name: str
    feature_count: int
    metrics: dict
    baseline_metrics: dict
    features: list[str]
    highlights: list[str]
    limitations: list[str]
