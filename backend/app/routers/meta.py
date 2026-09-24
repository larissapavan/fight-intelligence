from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.app.schemas.model_info import HealthResponse, ModelInfoResponse
from backend.app.services.catalog_service import get_total_fights_tracked, list_fighters
from backend.app.services.prediction_service import PredictionService
from backend.app.utils.constants import SYSTEM_TAGLINE


def build_meta_router(get_service) -> APIRouter:
    router = APIRouter(tags=["meta"])

    @router.get("/")
    def root() -> dict:
        return {
            "name": "UFC Fight Predictor API",
            "tagline": SYSTEM_TAGLINE,
            "health": "/health",
            "fighters": "/fighters",
            "events": "/events",
            "rankings": "/rankings",
            "predict": "/predict",
            "model_info": "/model-info",
        }

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        service: PredictionService | None = get_service()
        loaded = service is not None
        fighter_count = len(list_fighters()) if loaded else 0
        return HealthResponse(
            status="ok",
            model_loaded=loaded,
            fighters_loaded=fighter_count,
            fights_tracked=get_total_fights_tracked(),
        )

    @router.get("/model-info", response_model=ModelInfoResponse)
    def model_info() -> ModelInfoResponse:
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")
        return ModelInfoResponse(**service.model_info())

    return router
