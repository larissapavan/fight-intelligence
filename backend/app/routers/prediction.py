import logging
import time

from fastapi import APIRouter, HTTPException, Request, Response

from backend.app.rate_limit import limiter
from backend.app.schemas.prediction import DivisionMatrix, PredictionRequest, PredictionResponse, UpcomingPick
from backend.app.services.events_service import get_upcoming_events
from backend.app.services.prediction_service import PredictionService
from backend.app.services.rankings_service import get_rankings

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

    @router.get("/predict/upcoming", response_model=list[UpcomingPick])
    @limiter.limit("30/minute")
    def predict_upcoming(request: Request, response: Response) -> list[UpcomingPick]:
        """The model's pick for every fight on the announced cards (no SHAP breakdown, so it is cheap)."""
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")

        response.headers["Cache-Control"] = "public, max-age=600"
        now = time.monotonic()
        signature = tuple((event["name"], len(event["fights"])) for event in get_upcoming_events())
        if _upcoming_cache["signature"] != signature or now - _upcoming_cache["at"] > UPCOMING_CACHE_SECONDS:
            _upcoming_cache.update(signature=signature, at=now, picks=_predict_all(service))
        return _upcoming_cache["picks"]

    @router.get("/predict/division", response_model=DivisionMatrix)
    @limiter.limit("20/minute")
    def predict_division(request: Request, response: Response, category: str, top: int = DIVISION_DEFAULT_SIZE) -> DivisionMatrix:
        """The ranked fighters of one division against each other, and the round-robin standings."""
        service: PredictionService | None = get_service()
        if service is None:
            raise HTTPException(status_code=503, detail="Prediction service not initialized")
        if not DIVISION_MIN_SIZE <= top <= DIVISION_MAX_SIZE:
            raise HTTPException(status_code=422, detail=f"top must be between {DIVISION_MIN_SIZE} and {DIVISION_MAX_SIZE}.")
        ranking = next((c for c in get_rankings() if c["category"] == category and not c["is_p4p"]), None)
        if ranking is None:
            raise HTTPException(status_code=404, detail=f"No division called '{category}'.")

        response.headers["Cache-Control"] = "public, max-age=600"
        entries = sorted(ranking["entries"], key=lambda entry: entry["rank"])[:top]
        key = (category, tuple(entry["fighter"] for entry in entries))
        if key not in _division_cache or time.monotonic() - _division_cache[key][0] > UPCOMING_CACHE_SECONDS:
            _division_cache[key] = (time.monotonic(), service.division_matrix(category, entries))
        return DivisionMatrix(**_division_cache[key][1])

    return router


DIVISION_MIN_SIZE, DIVISION_DEFAULT_SIZE, DIVISION_MAX_SIZE = 3, 8, 12
_division_cache: dict = {}
UPCOMING_CACHE_SECONDS = 600
_upcoming_cache: dict = {"signature": None, "at": 0.0, "picks": []}


def _predict_all(service: PredictionService) -> list[UpcomingPick]:
    picks: list[UpcomingPick] = []
    for event in get_upcoming_events():
        for fight in event["fights"]:
            if not fight["fighter_1"] or not fight["fighter_2"]:
                continue
            try:
                result = service.predict_pick(fight["fighter_1"], fight["fighter_2"])
            except KeyError:
                continue  # a debutant with no profile yet
            picks.append(
                UpcomingPick(
                    event_name=event["name"],
                    event_date=event["date"],
                    fighter_1=fight["fighter_1"],
                    fighter_2=fight["fighter_2"],
                    predicted_winner=result["predicted_winner"],
                    probability=result["probability"],
                    fighter_1_probability=result["fighter_a_probability"],
                    title_fight=fight.get("title_fight"),
                    bmf_title=bool(fight.get("bmf_title")),
                    interim_title=bool(fight.get("interim_title")),
                )
            )
    return picks
