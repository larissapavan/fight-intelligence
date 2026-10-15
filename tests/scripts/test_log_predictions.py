import pandas as pd
import pytest

from backend.app.services import track_record_service
from scripts import log_predictions


class FakeService:
    def __init__(self):
        self.calls = []

    def predict_pick(self, a, b):
        self.calls.append((a, b))
        if "Unknown" in (a, b):
            raise KeyError("not in the catalog")
        return {"fighter_a_probability": 0.7, "predicted_winner": a, "probability": 0.7}


@pytest.fixture
def log_file(tmp_path, monkeypatch):
    monkeypatch.setattr(track_record_service, "PREDICTION_LOG_PATH", tmp_path / "prediction_log.csv")
    return tmp_path / "prediction_log.csv"


def upcoming(monkeypatch, fights, date="2026-11-07"):
    event = {"name": "UFC 999: Test", "date": date, "fights": [{"fighter_1": a, "fighter_2": b} for a, b in fights]}
    monkeypatch.setattr(log_predictions, "get_upcoming_events", lambda: [event])


def test_every_announced_fight_is_logged_once_with_the_pick_and_confidence(log_file, monkeypatch):
    upcoming(monkeypatch, [("Fighter One", "Fighter Two"), ("Fighter Three", "Unknown")])
    service = FakeService()

    assert log_predictions.log_upcoming(service, today="2026-11-01") == 1  # the debutant we cannot predict is skipped
    row = track_record_service.load_log().iloc[0]
    assert (row["predicted_winner"], row["confidence"], row["logged_at"]) == ("Fighter One", "0.7000", "2026-11-01")

    # A second run never re-predicts a fight that is already in the log, even with the corners swapped.
    upcoming(monkeypatch, [("Fighter Two", "Fighter One")])
    assert log_predictions.log_upcoming(service, today="2026-11-02") == 0
    assert len(track_record_service.load_log()) == 1


def test_fights_that_already_happened_are_not_logged(log_file, monkeypatch):
    upcoming(monkeypatch, [("Fighter One", "Fighter Two")], date="2026-10-01")
    assert log_predictions.log_upcoming(FakeService(), today="2026-10-15") == 0


def history(rows):
    frame = pd.DataFrame(rows, columns=["event_date_parsed", "fighter_1", "fighter_2", "winner"])
    frame["event_date_parsed"] = pd.to_datetime(frame["event_date_parsed"])
    return frame


def test_resolve_marks_picks_right_wrong_or_neither(log_file, monkeypatch):
    upcoming(monkeypatch, [("Fighter One", "Fighter Two"), ("Fighter Three", "Fighter Four"), ("Fighter Five", "Fighter Six"), ("Fighter Seven", "Fighter Eight")])
    log_predictions.log_upcoming(FakeService(), today="2026-11-01")

    monkeypatch.setattr(
        log_predictions,
        "_load_fight_history",
        lambda: history(
            [
                ("2026-11-07", "Fighter Two", "Fighter One", "Fighter One"),  # picked right (corners swapped in the results)
                ("2026-11-07", "Fighter Three", "Fighter Four", "Fighter Four"),  # picked wrong
                ("2026-11-07", "Fighter Five", "Fighter Six", None),  # draw: counts for nobody
            ]
        ),
    )
    assert log_predictions.resolve(today="2026-11-08") == 3

    log = track_record_service.load_log().set_index("fighter_1")
    assert log.loc["Fighter One", "correct"] == "True"
    assert log.loc["Fighter Three", "correct"] == "False" and log.loc["Fighter Three", "winner"] == "Fighter Four"
    assert log.loc["Fighter Five", "correct"] == "n/a"
    assert log.loc["Fighter Seven", "correct"] == ""  # no result yet: still pending
    assert log_predictions.resolve(today="2026-11-09") == 0  # settled fights are not settled again
