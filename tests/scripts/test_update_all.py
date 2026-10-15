import pytest

from scripts import update_all


@pytest.fixture
def calls(monkeypatch):
    log: list[tuple[str, object]] = []
    monkeypatch.setattr(update_all.scrape_espn, "main", lambda argv=None: log.append(("espn", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_rankings, "main", lambda: log.append(("rankings", None)))
    monkeypatch.setattr(update_all.download_fighter_photos, "main", lambda argv=None: log.append(("photos", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_fighter_origins, "main", lambda argv=None: log.append(("origins", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_roster_watch, "main", lambda: log.append(("roster", None)))
    monkeypatch.setattr(update_all.scrape_stat_leaders, "main", lambda: log.append(("records", None)))
    monkeypatch.setattr(update_all.log_predictions, "log_upcoming", lambda: log.append(("log", None)) or 0)
    monkeypatch.setattr(update_all.log_predictions, "resolve", lambda: log.append(("settle", None)) or 0)
    return log


def test_logs_picks_before_espn_and_settles_them_after(calls):
    assert update_all.main([]) == 0
    assert [name for name, _ in calls] == ["log", "espn", "settle", "rankings", "photos", "origins", "roster", "records"]


def test_dry_run_only_previews_the_espn_step(calls):
    assert update_all.main(["--dry-run", "--since", "2026-09-01"]) == 0
    assert calls == [("espn", ["--dry-run", "--since", "2026-09-01"])]


def test_skip_flags_are_respected(calls):
    update_all.main(["--skip-espn", "--skip-photos", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions"])
    assert [name for name, _ in calls] == ["rankings"]


def test_a_failing_step_does_not_stop_the_others_and_sets_exit_status(monkeypatch, calls, capsys):
    def boom(argv=None):
        raise RuntimeError("ESPN down")

    monkeypatch.setattr(update_all.scrape_espn, "main", boom)
    assert update_all.main([]) == 1
    assert [name for name, _ in calls] == ["log", "settle", "rankings", "photos", "origins", "roster", "records"]
    assert "FAILED" in capsys.readouterr().out
