from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.app.rate_limit import limiter
from backend.app.routers.events import router as events_router
from backend.app.routers.fight_history import router as fight_history_router
from backend.app.routers.fighters import router as fighters_router
from backend.app.routers.meta import build_meta_router
from backend.app.routers.prediction import build_prediction_router
from backend.app.routers.rankings import router as rankings_router
from backend.app.services.prediction_service import PredictionService

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def build_allowed_origins() -> list[str]:
    env_value = os.getenv("FRONTEND_ORIGINS", "")
    env_origins = [origin.strip() for origin in env_value.split(",") if origin.strip()]
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ufc-predictor.vercel.app",
        "https://ufcfightpredictor.vercel.app",
    ]
    return list(dict.fromkeys(defaults + env_origins))


prediction_service: PredictionService | None = None


def get_prediction_service() -> PredictionService | None:
    return prediction_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    global prediction_service
    try:
        prediction_service = PredictionService()
        logger.info("Prediction service initialized with %d features.", len(prediction_service.feature_columns))
    except Exception:
        logger.exception("Failed to initialize prediction service.")
        prediction_service = None
    try:
        yield
    finally:
        prediction_service = None


app = FastAPI(
    title="UFC Fight Predictor API",
    version="2.0.0",
    description="Backend service for predicting UFC fight outcomes with ML-powered analysis.",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=build_allowed_origins(),
    # Scoped to this project's own Vercel preview deployments (e.g.
    # ufc-predictor-git-<branch>-<team>.vercel.app), not any *.vercel.app site.
    allow_origin_regex=r"https://(ufc-predictor|ufcfightpredictor)[a-z0-9-]*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(build_meta_router(get_prediction_service))
app.include_router(fighters_router)
app.include_router(events_router)
app.include_router(rankings_router)
app.include_router(fight_history_router)
app.include_router(build_prediction_router(get_prediction_service))
