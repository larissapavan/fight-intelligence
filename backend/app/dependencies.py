"""Application dependencies and service provider singletons."""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from backend.app.services.prediction_service import PredictionService

_prediction_service: PredictionService | None = None


def get_prediction_service() -> PredictionService | None:
    """Retrieve the globally initialized PredictionService instance, if available."""
    return _prediction_service


def set_prediction_service(service: PredictionService | None) -> None:
    """Set or reset the globally initialized PredictionService instance."""
    global _prediction_service
    _prediction_service = service


PredictionServiceGetter = Callable[[], "PredictionService | None"]
