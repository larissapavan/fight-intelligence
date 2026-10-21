"""The /gyms endpoints, run against a tiny made-up gym directory and made-up UFC/PFL fighters."""

from __future__ import annotations

import csv

import pytest

from backend.app.services import gyms_service

GYM_FIELDS = ["slug", "name", "url", "fighters_count", "checked"]
FIGHTER_FIELDS = ["gym_slug", "fighter", "fighter_slug", "nickname", "division", "country_code", "record"]


def _write(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, restval="")
        writer.writeheader()
        writer.writerows(rows)


@pytest.fixture
def gyms(tmp_path, monkeypatch):
    _write(tmp_path / "gyms.csv", GYM_FIELDS, [
        {"slug": "big-gym", "name": "Big Gym", "url": "https://x.test/big-gym/", "fighters_count": 4},
        {"slug": "solo", "name": "Solo Club", "url": "https://x.test/solo/", "fighters_count": 1},
    ])
    _write(tmp_path / "gym_fighters.csv", FIGHTER_FIELDS, [
        {"gym_slug": "big-gym", "fighter": "Ana Silva", "fighter_slug": "ana-silva", "nickname": "The Arm", "division": "Lightweight", "country_code": "br", "record": "10-2-0"},
        {"gym_slug": "big-gym", "fighter": "Bia Costa", "fighter_slug": "bia-costa", "division": "Flyweight", "record": "5-5-0"},
        {"gym_slug": "big-gym", "fighter": "Caio Dias", "fighter_slug": "caio-dias", "division": "Heavyweight", "record": "12-0-0"},
        {"gym_slug": "big-gym", "fighter": "Zed Unknown", "fighter_slug": "zed", "division": "Welterweight", "record": "1-0-0"},
        {"gym_slug": "solo", "fighter": "Dóra Reis", "fighter_slug": "dora-reis", "record": "3-4-0"},
    ])
    monkeypatch.setattr(gyms_service, "GYMS_PATH", tmp_path / "gyms.csv")
    monkeypatch.setattr(gyms_service, "GYM_FIGHTERS_PATH", tmp_path / "gym_fighters.csv")
    monkeypatch.setattr(
        gyms_service,
        "_known_fighters",
        lambda: {
            "ana silva": {"ufc": {"name": "Ana Silva", "image_url": "/ufc/ana.webp", "belt": False, "is_active": True}},
            "bia costa": {
                "ufc": {"name": "Bia Costa", "image_url": None, "belt": False, "is_active": False},
                "pfl": {"name": "Bia Costa", "image_url": "/pfl/bia.webp", "belt": False, "is_active": True},
            },
            "caio dias": {"pfl": {"name": "Caio Dias", "image_url": "/pfl/caio.webp", "belt": True, "is_active": True}},
            "dora reis": {"pfl": {"name": "Dora Reis", "image_url": None, "belt": False, "is_active": False}},
        },
    )
    monkeypatch.setattr(gyms_service, "_signature", lambda: object())
    gyms_service._cache.update(signature=None, data=None)
    yield
    gyms_service._cache.update(signature=None, data=None)


def test_the_list_counts_each_organizations_fighters_and_champions(client, gyms):
    listing = client.get("/gyms").json()
    big = next(gym for gym in listing if gym["slug"] == "big-gym")
    assert big["fighters_count"] == 4
    assert big["orgs"] == {"ufc": 2, "pfl": 2}
    assert big["champions"] == 1
    assert "fighters" not in big
    assert "max-age" in client.get("/gyms").headers["cache-control"]


def test_a_gym_lists_champions_then_known_fighters_then_the_rest(client, gyms):
    detail = client.get("/gyms/big-gym").json()
    assert [fighter["name"] for fighter in detail["fighters"]] == ["Caio Dias", "Ana Silva", "Bia Costa", "Zed Unknown"]
    caio, ana, bia, zed = detail["fighters"]
    assert caio["belt"] is True and caio["orgs"] == ["pfl"]
    assert ana["image_url"] == "/ufc/ana.webp" and ana["nickname"] == "The Arm" and ana["country_code"] == "br"
    assert bia["orgs"] == ["pfl", "ufc"]  # the one he is active in first
    assert bia["image_url"] == "/pfl/bia.webp"
    assert zed["orgs"] == [] and zed["image_url"] is None


def test_names_are_matched_ignoring_accents_and_case(client, gyms):
    solo = client.get("/gyms/solo").json()
    assert solo["fighters"][0]["name"] == "Dora Reis"
    assert solo["fighters"][0]["orgs"] == ["pfl"]


def test_an_unknown_gym_is_a_404(client, gyms):
    assert client.get("/gyms/nope").status_code == 404


def test_without_data_files_the_answers_are_empty(client, tmp_path, monkeypatch):
    monkeypatch.setattr(gyms_service, "GYMS_PATH", tmp_path / "none.csv")
    monkeypatch.setattr(gyms_service, "GYM_FIGHTERS_PATH", tmp_path / "none2.csv")
    monkeypatch.setattr(gyms_service, "_known_fighters", lambda: {})
    monkeypatch.setattr(gyms_service, "_signature", lambda: object())
    gyms_service._cache.update(signature=None, data=None)
    assert client.get("/gyms").json() == []
    gyms_service._cache.update(signature=None, data=None)
