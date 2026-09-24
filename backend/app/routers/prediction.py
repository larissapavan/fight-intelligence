import logging

from fastapi import APIRouter, HTTPException, Request

from backend.app.rate_limit import limiter
from backend.app.schemas.prediction import PredictionRequest, PredictionResponse
from backend.app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)


def build_prediction_router(get_service) -> APIRouter:
    router = APIRouter(tags=["prediction"])

    @router.post("/predict", response_model=PredictionResponse)
    @limiter.limit("20/minute")
    def predict(request: Request, payload: PredictionRequest) -> PredictionResponse:
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")

        try:
            result = service.predict_matchup(
                fighter_a_name=payload.fighter_a,
                fighter_b_name=payload.fighter_b,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception:
            logger.exception("Unexpected error predicting %s vs %s", payload.fighter_a, payload.fighter_b)
            raise HTTPException(status_code=500, detail="Prediction failed unexpectedly.") from None

        return PredictionResponse(**result)

    return router
