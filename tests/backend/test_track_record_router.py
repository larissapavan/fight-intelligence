import pandas as pd
import pytest

from backend.app.services import track_record_service as service


def row(key, confidence, correct, event_date="2026-11-07", predicted="A", winner=""):
    return {
        "fight_key": key,
        "event_name": "UFC 999",
        "event_date": event_date,
        "fighter_1": "A",
        "fighter_2": "B",
        "prob_fighter_1": "0.5",
        "predicted_winner": predicted,
        "confidence": str(confidence),
        "logged_at": "2026-11-01",
        "winner": winner,
        "correct": correct,
        "resolved_at": "2026-11-08" if correct else "",
    }


@pytest.fixture
def fake_log(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "PREDICTION_LOG_PATH", tmp_path / "prediction_log.csv")
    service._cache.update({"signature": None, "data": None})
    yield tmp_path / "prediction_log.csv"
    service._cache.update({"signature": None, "data": None})


def test_without_a_log_the_page_says_tracking_has_not_started(client, fake_log):
    body = client.get("/track-record").json()
    assert body["logged"] == 0 and body["resolved"] == 0 and body["accuracy"] is None
    assert body["bands"] == [] and body["recent"] == []


def test_accuracy_bands_and_misses_come_from_the_settled_fights(client, fake_log):
    service.save_log(
        pd.DataFrame(
            [
                row("1", 0.55, "True", winner="A"),
                row("2", 0.65, "False", winner="B"),
                row("3", 0.92, "False", winner="B"),
                row("4", 0.85, "True", winner="A"),
                row("5", 0.7, "n/a", winner="Draw / no contest"),
                row("6", 0.75, "", event_date="2026-11-14"),
            ],
            columns=service.LOG_COLUMNS,
        )
    )
    body = client.get("/track-record").json()

    assert (body["logged"], body["resolved"], body["correct"], body["pending"]) == (6, 4, 2, 1)
    assert body["accuracy"] == 0.5
    assert body["next_event"] == {"name": "UFC 999", "date": "2026-11-14"}
    assert [band["label"] for band in body["bands"]] == ["50-60%", "60-70%", "80%+"]
    assert body["biggest_misses"][0]["confidence"] == 0.92  # the most confident wrong pick comes first
    assert all(fight["winner"] for fight in body["recent"])


def test_track_record_is_cacheable(client):
    assert "max-age" in client.get("/track-record").headers.get("cache-control", "")
