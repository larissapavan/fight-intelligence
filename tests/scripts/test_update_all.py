from datetime import date

import pytest

from scripts import update_all


@pytest.fixture
def calls(monkeypatch):
    log: list[tuple[str, object]] = []
    monkeypatch.setattr(update_all.scrape_espn, "main", lambda argv=None: log.append(("espn", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_fight_stats, "main", lambda argv=None: log.append(("stats", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_rankings, "main", lambda: log.append(("rankings", None)))
    monkeypatch.setattr(update_all.download_fighter_photos, "main", lambda argv=None: log.append(("photos", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_fighter_origins, "main", lambda argv=None: log.append(("origins", list(argv or []))))
    monkeypatch.setattr(update_all.scrape_roster_watch, "main", lambda: log.append(("roster", None)))
    monkeypatch.setattr(update_all.scrape_stat_leaders, "main", lambda: log.append(("records", None)))
    monkeypatch.setattr(update_all.scrape_pfl, "main", lambda argv=None: log.append(("pfl", list(argv or []))) or 0)
    monkeypatch.setattr(update_all.scrape_gyms, "main", lambda argv=None: log.append(("gyms", list(argv or []))) or 0)
    monkeypatch.setattr(update_all.log_predictions, "log_upcoming", lambda: log.append(("log", None)) or 0)
    monkeypatch.setattr(update_all.log_predictions, "resolve", lambda: log.append(("settle", None)) or 0)
    return log


def test_logs_picks_before_espn_and_settles_them_after(calls):
    assert update_all.main([]) == 0
    assert [name for name, _ in calls] == ["log", "espn", "settle", "stats", "rankings", "photos", "origins", "roster", "records", "pfl", "gyms"]


def test_dry_run_only_previews_the_espn_and_pfl_steps(calls):
    assert update_all.main(["--dry-run", "--since", "2026-09-01"]) == 0
    assert calls == [("espn", ["--dry-run", "--since", "2026-09-01"]), ("pfl", ["--dry-run"]), ("gyms", ["--dry-run"])]


def test_skip_flags_are_respected(calls):
    update_all.main(["--skip-espn", "--skip-photos", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions", "--skip-stats", "--skip-pfl", "--skip-gyms"])
    assert [name for name, _ in calls] == ["rankings"]


def test_a_failing_step_does_not_stop_the_others_and_sets_exit_status(monkeypatch, calls, capsys):
    def boom(argv=None):
        raise RuntimeError("ESPN down")

    monkeypatch.setattr(update_all.scrape_espn, "main", boom)
    assert update_all.main([]) == 1
    assert [name for name, _ in calls] == ["log", "settle", "stats", "rankings", "photos", "origins", "roster", "records", "pfl", "gyms"]
    assert "FAILED" in capsys.readouterr().out


def test_the_daily_update_collects_statistics_only_for_the_last_month(calls):
    update_all.main(["--skip-espn", "--skip-rankings", "--skip-photos", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions"])
    [(name, args)] = [c for c in calls if c[0] == "stats"]
    assert args[0] == "--since" and (date.today() - date.fromisoformat(args[1])).days == update_all.FIGHT_STATS_DAYS


def test_a_dry_run_collects_no_statistics(calls):
    update_all.main(["--dry-run"])
    assert "stats" not in [name for name, _ in calls]


def test_the_pfl_step_downloads_photos_unless_photos_are_skipped(calls):
    update_all.main(["--skip-espn", "--skip-rankings", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions", "--skip-stats", "--skip-photos"])
    assert ("pfl", []) in calls

    calls.clear()
    update_all.main(["--skip-espn", "--skip-rankings", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions", "--skip-stats"])
    assert ("pfl", ["--photos"]) in calls


def test_a_pfl_scraper_that_finds_nothing_fails_the_run(monkeypatch, calls, capsys):
    monkeypatch.setattr(update_all.scrape_pfl, "main", lambda argv=None: 1)
    assert update_all.main(["--skip-espn", "--skip-rankings", "--skip-photos", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions", "--skip-stats"]) == 1
    assert "PFL (pflmma.com): FAILED" in capsys.readouterr().out


def test_a_gym_scraper_that_finds_nothing_fails_the_run(monkeypatch, calls, capsys):
    monkeypatch.setattr(update_all.scrape_gyms, "main", lambda argv=None: 1)
    assert update_all.main(["--skip-espn", "--skip-rankings", "--skip-photos", "--skip-origins", "--skip-roster", "--skip-records", "--skip-predictions", "--skip-stats", "--skip-pfl"]) == 1
    assert "Gyms (FightHub): FAILED" in capsys.readouterr().out
