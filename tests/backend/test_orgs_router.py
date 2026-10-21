"""The generic /orgs/{id} endpoints, run against a tiny made-up organisation so the tests do not depend on scraped data."""

from __future__ import annotations

import csv
from datetime import date, timedelta
from pathlib import Path

import pytest

from backend.app.services import org_service

FIGHT_FIELDS = [
    "event_name", "event_date", "location", "event_url", "event_slug", "circuit", "fight_url", "card_order",
    "fighter_1", "fighter_2", "fighter_1_url", "fighter_2_url", "winner", "outcome",
    "weight_class", "stage", "title_fight", "method", "method_detail", "round", "time",
]
FIGHTER_FIELDS = [
    "name", "slug", "profile_url", "circuit", "nickname", "status", "career_record", "org_record",
    "wins", "losses", "draws", "no_contests", "age", "height_cm", "weight_lbs", "reach_cm", "leg_reach_cm",
    "hometown", "country", "country_code", "fighting_out_of", "camp", "weight_class", "headshot_url", "image_url",
    "first_fight_date", "last_fight_date", "checked",
]
RANKING_FIELDS = ["category", "is_p4p", "rank", "fighter", "rank_change", "status", "athlete_url"]

PAST = (date.today() - timedelta(days=60)).isoformat()
OLDER = (date.today() - timedelta(days=400)).isoformat()
NEXT = (date.today() + timedelta(days=30)).isoformat()


def _write(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, restval="")
        writer.writeheader()
        writer.writerows(rows)


def _fight(slug, name, day, order, a, b, winner="", **extra):
    return {
        "event_name": name, "event_date": day, "location": "Test Arena", "event_url": f"https://example.test/event/{slug}",
        "event_slug": slug, "circuit": "TEST", "fight_url": f"https://example.test/event/{slug}#fight-{order}",
        "card_order": order, "fighter_1": a, "fighter_2": b, "winner": winner, "outcome": "win" if winner else "",
        "weight_class": "Lightweight", **extra,
    }


def _fighter(name, record, **extra):
    wins, losses, draws = record
    return {
        "name": name, "slug": name.lower().replace(" ", "-"), "profile_url": f"https://example.test/{name}", "status": "active",
        "wins": wins, "losses": losses, "draws": draws, "weight_class": "Lightweight", "country_code": "br", "checked": "2026-10-01",
        **extra,
    }


@pytest.fixture
def org(tmp_path, monkeypatch):
    fights = [
        # Written in card order within the event; the main event is first.
        _fight("older", "Older Card", OLDER, 0, "Ana Silva", "Bia Costa", "Ana Silva", method="SUB", method_detail="Armbar", round=2, time="3:10"),
        _fight("past", "Past Card", PAST, 0, "Ana Silva", "Caio Dias", "Caio Dias", method="U-DEC", round=3, time="5:00", title_fight="true", stage="Championship"),
        _fight("past", "Past Card", PAST, 1, "Bia Costa", "Dora Reis", "Bia Costa", method="KO/TKO", round=1, time="0:46"),
        _fight("next", "Next Card", NEXT, 0, "Caio Dias", "Dora Reis"),
    ]
    fighters = [
        _fighter("Ana Silva", (10, 2, 1), nickname="The Arm", image_url="/fighter-photos/pfl/ana-silva.webp", org_record="2-1-0", last_fight_date=PAST),
        _fighter("Bia Costa", (5, 5, 0), last_fight_date=PAST),
        _fighter("Caio Dias", (12, 0, 0), last_fight_date=PAST),
        _fighter("Dora Reis", (3, 4, 0), status="inactive"),
    ]
    rankings = [
        {"category": "Lightweight", "is_p4p": "False", "rank": 0, "fighter": "Caio Dias", "status": "champion"},
        {"category": "Lightweight", "is_p4p": "False", "rank": 1, "fighter": "Ana Silva", "rank_change": "up 1"},
        {"category": "Lightweight", "is_p4p": "False", "rank": 2, "fighter": "Bia Costa"},
        {"category": "Heavyweight", "is_p4p": "False", "rank": 0, "fighter": "", "status": "vacant"},
        {"category": "Heavyweight", "is_p4p": "False", "rank": 1, "fighter": "Somebody Unknown"},
        {"category": "Pound-for-Pound (Men's)", "is_p4p": "True", "rank": 1, "fighter": "Caio Dias"},
    ]
    _write(tmp_path / "fights.csv", FIGHT_FIELDS, fights)
    _write(tmp_path / "fighters.csv", FIGHTER_FIELDS, fighters)
    _write(tmp_path / "rankings.csv", RANKING_FIELDS, rankings)

    test_org = org_service.Org(id="test", name="Test League", short_name="TL", tagline="A made-up league.", sources=("example.test",), root=tmp_path)
    monkeypatch.setitem(org_service.ORGS, "test", test_org)
    org_service._cache.pop("test", None)
    yield test_org
    org_service._cache.pop("test", None)


def test_unknown_organisation_is_a_404(client):
    assert client.get("/orgs/nope/fighters").status_code == 404
    assert client.get("/orgs/nope/events").status_code == 404


def test_the_ufc_is_not_served_by_the_generic_endpoints(client):
    assert client.get("/orgs/ufc/fighters").status_code == 404


def test_lists_the_registered_organisations(client, org):
    listing = client.get("/orgs").json()
    assert {"id": "test", "name": "Test League", "short_name": "TL", "tagline": "A made-up league.", "sources": ["example.test"]} in listing
    assert any(item["id"] == "pfl" for item in listing)


def test_events_split_into_past_and_upcoming_and_keep_card_order(client, org):
    past = client.get("/orgs/test/events").json()
    assert [event["name"] for event in past] == ["Past Card", "Older Card"]
    card = past[0]
    assert card["fight_count"] == 2
    assert [fight["fighter_1"] for fight in card["fights"]] == ["Ana Silva", "Bia Costa"]
    assert card["fights"][0]["title_fight"] is True
    assert card["fights"][0]["stage"] == "Championship"
    assert card["fights"][1]["title_fight"] is None
    assert card["circuit"] == "TEST"

    upcoming = client.get("/orgs/test/events/upcoming").json()
    assert [event["name"] for event in upcoming] == ["Next Card"]
    assert upcoming[0]["fights"][0]["winner"] is None


def test_fighters_carry_record_titles_ranking_and_next_fight(client, org):
    response = client.get("/orgs/test/fighters")
    assert response.headers["x-total-count"] == "4"
    fighters = {fighter["name"]: fighter for fighter in response.json()}

    ana = fighters["Ana Silva"]
    assert (ana["wins"], ana["losses"], ana["draws"], ana["total_fights"]) == (10, 2, 1, 13)
    assert ana["win_rate"] == pytest.approx(10 / 13, abs=1e-4)
    assert ana["ranking"] == "#1 Lightweight"
    assert ana["belt"] is False
    assert ana["org_record"] == "2-1-0"
    assert ana["image_url"] == "/fighter-photos/pfl/ana-silva.webp"
    assert ana["org_fights"] == 2
    assert ana["next_fight"] is None

    caio = fighters["Caio Dias"]
    assert caio["belt"] is True and caio["title_status"] == "champion"
    assert caio["ranking"] == "Champion · Lightweight"
    assert caio["next_fight"]["opponent"] == "Dora Reis"
    assert caio["next_fight"]["event"] == "Next Card"

    assert fighters["Dora Reis"]["is_active"] is False


def test_active_fighters_come_first(client, org):
    names = [fighter["name"] for fighter in client.get("/orgs/test/fighters").json()]
    assert names[-1] == "Dora Reis"


def test_fighters_can_be_paged(client, org):
    page = client.get("/orgs/test/fighters", params={"limit": 2, "offset": 1}).json()
    assert len(page) == 2


def test_fighter_fights_are_newest_first_with_result_from_the_fighters_side(client, org):
    fights = client.get("/orgs/test/fighters/Ana Silva/fights").json()
    assert [fight["opponent"] for fight in fights] == ["Caio Dias", "Bia Costa"]
    assert [fight["result"] for fight in fights] == ["loss", "win"]
    assert fights[1]["method"] == "SUB" and fights[1]["method_detail"] == "Armbar" and fights[1]["round"] == 2

    upcoming = client.get("/orgs/test/fighters/Caio Dias/fights").json()
    assert upcoming[0]["opponent"] == "Dora Reis" and upcoming[0]["result"] is None


def test_fighter_fights_lookup_ignores_case_and_accents(client, org):
    assert client.get("/orgs/test/fighters/ana silva/fights").status_code == 200
    assert client.get("/orgs/test/fighters/Nobody Here/fights").status_code == 404


def test_rankings_put_p4p_first_and_know_vacant_titles(client, org):
    rankings = client.get("/orgs/test/rankings").json()
    assert [category["category"] for category in rankings] == ["Pound-for-Pound (Men's)", "Lightweight", "Heavyweight"]

    lightweight = rankings[1]["entries"]
    assert [(entry["rank"], entry["fighter"]) for entry in lightweight] == [(0, "Caio Dias"), (1, "Ana Silva"), (2, "Bia Costa")]
    assert lightweight[0]["status"] == "champion"
    assert lightweight[1]["rank_change"] == "up 1"
    assert lightweight[1]["win_rate"] == pytest.approx(10 / 13, abs=1e-4)
    assert lightweight[1]["last_fight"] == PAST

    heavyweight = rankings[2]["entries"]
    assert [entry["fighter"] for entry in heavyweight] == ["Somebody Unknown"]  # the vacant title has no row
    assert heavyweight[0]["win_rate"] is None


def test_data_info_counts(client, org):
    info = client.get("/orgs/test/data-info").json()
    assert info == {"last_updated": "2026-10-01", "fighters_count": 4, "events_count": 2, "fights_count": 3, "sources": ["example.test"]}


def test_endpoints_are_cacheable(client, org):
    for path in ("fighters", "events", "events/upcoming", "rankings", "data-info"):
        assert "max-age" in client.get(f"/orgs/test/{path}").headers["cache-control"]


def test_missing_files_give_empty_answers(client, tmp_path, monkeypatch):
    empty = org_service.Org(id="empty", name="Empty", short_name="EM", tagline="", sources=(), root=tmp_path)
    monkeypatch.setitem(org_service.ORGS, "empty", empty)
    org_service._cache.pop("empty", None)
    assert client.get("/orgs/empty/fighters").json() == []
    assert client.get("/orgs/empty/events").json() == []
    assert client.get("/orgs/empty/rankings").json() == []
    assert client.get("/orgs/empty/data-info").json()["last_updated"] is None


def test_data_is_rebuilt_when_a_file_changes(client, org):
    assert len(client.get("/orgs/test/fighters").json()) == 4
    _write(org.data_dir / "fighters.csv", FIGHTER_FIELDS, [_fighter("Only One", (1, 0, 0))])
    # The signature is the files' modification times; make sure it differs even on a coarse clock.
    import os

    stat = (org.data_dir / "fighters.csv").stat()
    os.utime(org.data_dir / "fighters.csv", ns=(stat.st_atime_ns, stat.st_mtime_ns + 10_000_000))
    assert [fighter["name"] for fighter in client.get("/orgs/test/fighters").json()] == ["Only One"]


def test_the_last_fight_ignores_a_booked_one(client, org):
    entry = next(entry for category in client.get("/orgs/test/rankings").json() for entry in category["entries"] if entry["fighter"] == "Caio Dias")
    assert entry["last_fight"] == PAST  # he also has a fight on the Next Card, a month from now


def test_an_organization_without_its_own_record_gets_one_counted_from_its_bouts(client, org):
    fighters = {fighter["name"]: fighter for fighter in client.get("/orgs/test/fighters").json()}
    assert fighters["Bia Costa"]["org_record"] == "1-1-0"  # beat Dora, lost to Ana
    assert fighters["Ana Silva"]["org_record"] == "2-1-0"  # the file's own value wins over the count
    assert fighters["Dora Reis"]["org_record"] == "0-1-0"
