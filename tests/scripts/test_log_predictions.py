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


def log_rows(log_file):
    rows = []
    for key, event_date, correct, winner in (
        ("future-open", "2026-11-07", "", ""),
        ("future-open-2", "2026-12-05", "", ""),
        ("already-happened", "2026-10-17", "", ""),  # the event took place, its result is just not in yet
        ("settled", "2026-10-10", "True", "Fighter One"),
        ("today", "2026-10-20", "", ""),  # fights may be under way: not touched
    ):
        rows.append(
            {
                "fight_key": key, "event_name": "UFC", "event_date": event_date, "fighter_1": "Fighter One",
                "fighter_2": "Fighter Two", "prob_fighter_1": "0.9500", "predicted_winner": "Fighter Two",
                "confidence": "0.9500", "logged_at": "2026-10-15", "winner": winner, "correct": correct,
                "resolved_at": "2026-10-11" if correct else "",
            }
        )
    track_record_service.save_log(pd.DataFrame(rows, columns=track_record_service.LOG_COLUMNS))


def test_refresh_unresolved_re_predicts_only_fights_still_to_come(log_file):
    log_rows(log_file)

    assert log_predictions.refresh_unresolved(FakeService(), today="2026-10-20") == 2

    log = track_record_service.load_log().set_index("fight_key")
    for key in ("future-open", "future-open-2"):  # re-made with today's model, before the fight
        assert (log.at[key, "predicted_winner"], log.at[key, "confidence"], log.at[key, "logged_at"]) == ("Fighter One", "0.7000", "2026-10-20")
        assert log.at[key, "prob_fighter_1"] == "0.7000"
    for key in ("already-happened", "settled", "today"):  # exactly as they were shown
        assert (log.at[key, "predicted_winner"], log.at[key, "confidence"], log.at[key, "logged_at"]) == ("Fighter Two", "0.9500", "2026-10-15")
    assert log.at["settled", "correct"] == "True"


def test_refresh_unresolved_keeps_the_pick_of_a_fighter_who_left_the_catalog(log_file):
    log_rows(log_file)
    log = track_record_service.load_log()
    log.loc[log["fight_key"] == "future-open", "fighter_2"] = "Unknown"
    track_record_service.save_log(log)

    assert log_predictions.refresh_unresolved(FakeService(), today="2026-10-20") == 1
    kept = track_record_service.load_log().set_index("fight_key").loc["future-open"]
    assert (kept["predicted_winner"], kept["logged_at"]) == ("Fighter Two", "2026-10-15")
