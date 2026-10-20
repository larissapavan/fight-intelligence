from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.app.schemas.data_info import DataInfoResponse
from backend.app.schemas.model_info import HealthResponse, ModelInfoResponse
from backend.app.services.catalog_service import (
    get_latest_fight_date,
    get_total_fights_tracked,
    list_fighters,
)
from backend.app.services.data_info_service import get_data_info
from backend.app.services.prediction_service import PredictionService
from backend.app.utils.constants import SYSTEM_TAGLINE


def build_meta_router(get_service) -> APIRouter:
    router = APIRouter(tags=["meta"])

    @router.get("/")
    def root() -> dict:
        return {
            "name": "Fight Intelligence API",
            "tagline": SYSTEM_TAGLINE,
            "health": "/health",
            "fighters": "/fighters",
            "events": "/events",
            "rankings": "/rankings",
            "champions": "/champions",
            "record_book": "/record-book",
            "news": "/news",
            "track_record": "/track-record",
            "predict": "/predict",
            "model_info": "/model-info",
            "data_info": "/data-info",
        }

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        """Liveness probe used by the frontend while a sleeping host is waking up."""
        service: PredictionService | None = get_service()
        loaded = service is not None
        fighter_count = len(list_fighters(ufc_only=True)) if loaded else 0
        return HealthResponse(
            status="ok",
            model_loaded=loaded,
            fighters_loaded=fighter_count,
            fights_tracked=get_total_fights_tracked(),
            latest_fight_date=get_latest_fight_date(),
        )

    @router.get("/model-info", response_model=ModelInfoResponse)
    def model_info() -> ModelInfoResponse:
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")
        return ModelInfoResponse(**service.model_info())

    @router.get("/data-info", response_model=DataInfoResponse)
    def data_info() -> DataInfoResponse:
        return DataInfoResponse(**get_data_info())

    return router
