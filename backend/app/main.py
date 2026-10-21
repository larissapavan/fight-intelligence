from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.app.rate_limit import limiter
from backend.app.routers.champions import router as champions_router
from backend.app.routers.events import router as events_router
from backend.app.routers.fight_history import router as fight_history_router
from backend.app.routers.fighters import router as fighters_router
from backend.app.routers.gyms import router as gyms_router
from backend.app.routers.meta import build_meta_router
from backend.app.routers.news import router as news_router
from backend.app.routers.orgs import router as orgs_router
from backend.app.routers.prediction import build_prediction_router
from backend.app.routers.rankings import router as rankings_router
from backend.app.routers.record_book import router as record_book_router
from backend.app.routers.track_record import router as track_record_router
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
        "https://fight-intelligence.vercel.app",
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
    title="Fight Intelligence API",
    version="2.0.0",
    description="Backend service for predicting UFC fight outcomes with ML-powered analysis.",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
# The fighter catalog is a few MB of repetitive JSON; it shrinks ~10x on the wire.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=build_allowed_origins(),
    # Scoped to this project's own Vercel preview deployments (e.g.
    # ufc-predictor-git-<branch>-<team>.vercel.app, fight-intelligence-git-...), not any *.vercel.app site.
    allow_origin_regex=r"https://(ufc-predictor|ufcfightpredictor|fight-intelligence)[a-z0-9-]*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


app.include_router(build_meta_router(get_prediction_service))
app.include_router(fighters_router)
app.include_router(events_router)
app.include_router(rankings_router)
app.include_router(fight_history_router)
app.include_router(champions_router)
app.include_router(record_book_router)
app.include_router(news_router)
app.include_router(orgs_router)
app.include_router(gyms_router)
app.include_router(track_record_router)
app.include_router(build_prediction_router(get_prediction_service))
