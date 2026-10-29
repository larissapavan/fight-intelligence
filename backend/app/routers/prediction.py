"""Prediction endpoints for fighter matchups, division matrices, and upcoming fight picks."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from fastapi import APIRouter, HTTPException, Request, Response

from backend.app.dependencies import PredictionServiceGetter, get_prediction_service
from backend.app.rate_limit import limiter
from backend.app.schemas.prediction import DivisionMatrix, PredictionRequest, PredictionResponse, UpcomingPick
from backend.app.services.events_service import get_upcoming_events
from backend.app.services.prediction_service import PredictionService
from backend.app.services.rankings_service import get_rankings

logger = logging.getLogger(__name__)

DIVISION_MIN_SIZE: int = 3
DIVISION_DEFAULT_SIZE: int = 8
DIVISION_MAX_SIZE: int = 12
UPCOMING_CACHE_SECONDS: float = 600.0

DivisionCacheKey = tuple[str, tuple[str, ...]]
_division_cache: dict[DivisionCacheKey, tuple[float, dict[str, Any]]] = {}
_upcoming_cache: dict[str, Any] = {"signature": None, "at": 0.0, "picks": []}


def _predict_all_upcoming(service: PredictionService) -> list[UpcomingPick]:
    """Calculate quick prediction picks for all fighters scheduled in upcoming events."""
    picks: list[UpcomingPick] = []
    for event in get_upcoming_events():
        for fight in event.get("fights", []):
            fighter_1 = fight.get("fighter_1")
            fighter_2 = fight.get("fighter_2")
            if not fighter_1 or not fighter_2:
                continue
            if str(fighter_1).strip().upper() in ("TBD", "TBA") or str(fighter_2).strip().upper() in ("TBD", "TBA"):
                continue
            try:
                result = service.predict_pick(fighter_1, fighter_2)
            except KeyError:
                # Debutant or fighter with no historical catalog profile yet
                continue
            picks.append(
                UpcomingPick(
                    event_name=event.get("name", ""),
                    event_date=event.get("date"),
                    fighter_1=fighter_1,
                    fighter_2=fighter_2,
                    predicted_winner=result["predicted_winner"],
                    probability=result["probability"],
                    fighter_1_probability=result["fighter_a_probability"],
                    title_fight=fight.get("title_fight"),
                    bmf_title=bool(fight.get("bmf_title")),
                    interim_title=bool(fight.get("interim_title")),
                )
            )
    return picks


def build_prediction_router(
    get_service: PredictionServiceGetter = get_prediction_service,
) -> APIRouter:
    """Build the prediction router with injected service retriever."""
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

    @router.get("/predict/upcoming", response_model=list[UpcomingPick])
    @limiter.limit("30/minute")
    def predict_upcoming(request: Request, response: Response) -> list[UpcomingPick]:
        """The model's pick for every fight on the announced cards (no SHAP breakdown, so it is cheap)."""
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")

        response.headers["Cache-Control"] = "public, max-age=600"
        now = time.monotonic()
        events = get_upcoming_events()
        signature = tuple((event["name"], len(event.get("fights", []))) for event in events)
        if _upcoming_cache["signature"] != signature or now - _upcoming_cache["at"] > UPCOMING_CACHE_SECONDS:
            _upcoming_cache.update(
                signature=signature,
                at=now,
                picks=_predict_all_upcoming(service),
            )
        return _upcoming_cache["picks"]

    @router.get("/predict/division", response_model=DivisionMatrix)
    @limiter.limit("20/minute")
    def predict_division(
        request: Request,
        response: Response,
        category: str,
        top: int = DIVISION_DEFAULT_SIZE,
    ) -> DivisionMatrix:
        """The ranked fighters of one division against each other, and the round-robin standings."""
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")
        if not DIVISION_MIN_SIZE <= top <= DIVISION_MAX_SIZE:
            raise HTTPException(
                status_code=422,
                detail=f"top must be between {DIVISION_MIN_SIZE} and {DIVISION_MAX_SIZE}.",
            )

        ranking = next((c for c in get_rankings() if c["category"] == category and not c["is_p4p"]), None)
        if ranking is None:
            raise HTTPException(status_code=404, detail=f"No division called '{category}'.")

        response.headers["Cache-Control"] = "public, max-age=600"
        entries = sorted(ranking["entries"], key=lambda entry: entry["rank"])[:top]
        key: DivisionCacheKey = (category, tuple(entry["fighter"] for entry in entries))
        if key not in _division_cache or time.monotonic() - _division_cache[key][0] > UPCOMING_CACHE_SECONDS:
            _division_cache[key] = (time.monotonic(), service.division_matrix(category, entries))
        return DivisionMatrix(**_division_cache[key][1])

    return router
