"""Fighters who fought in the UFC and in the PFL or Bellator: one history, and the UFC model left alone."""

import re
from pathlib import Path

import pandas as pd
import pytest

from backend.app.services import crossorg_service as crossorg
from src.ufc_predictor.config import RAW_DATA_DIR

PICO = "Aaron Pico"  # Bellator champion, a PFL fight, then the UFC


def test_a_ufc_fighter_shows_what_they_did_elsewhere(client):
    response = client.get(f"/fighters/{PICO}/other-organizations")
    assert response.status_code == 200
    by_org = {item["org_id"]: item for item in response.json()}

    assert {"pfl", "bellator"} <= set(by_org)
    bellator = by_org["bellator"]
    assert bellator["short_name"] == "Bellator" and bellator["org_record"] and len(bellator["fights"]) > 10
    assert all(fight["opponent"] and fight["event_name"] for fight in bellator["fights"])
    dates = [fight["date"] for fight in bellator["fights"] if fight["date"]]
    assert dates == sorted(dates, reverse=True)  # newest first, like every other history on the site


def test_a_fighter_who_only_fought_in_the_ufc_has_nothing_to_add(client):
    only_ufc = next(
        name for name in client.get("/fighters").json()[:300]
        if not crossorg.other_organizations(name["name"])
    )["name"]
    assert client.get(f"/fighters/{only_ufc}/other-organizations").json() == []


def test_an_unknown_fighter_is_a_404(client):
    assert client.get("/fighters/Nobody Nonexistent/other-organizations").status_code == 404


def test_the_organization_lists_point_back_to_the_ufc_profile(client):
    fighters = client.get("/orgs/bellator/fighters").json()
    linked = {fighter["name"]: fighter["ufc_name"] for fighter in fighters if fighter["ufc_name"]}
    assert linked[PICO] == PICO
    assert 300 < len(linked) < 700  # hundreds of fighters, not the whole archive


def test_every_link_passes_the_guards(client):
    catalog = {record["name"]: record for record in client.get("/fighters").json()}
    for org in ("pfl", "bellator"):
        for fighter in client.get(f"/orgs/{org}/fighters").json():
            if not fighter["ufc_name"]:
                continue
            ufc = catalog[fighter["ufc_name"]]
            assert ufc["ufc_status"] != "never"  # someone who really fought in the UFC
            assert crossorg._linked((ufc["name"], ufc["division"]), fighter["division"])


@pytest.mark.parametrize(
    ("ufc_division", "org_division", "linked"),
    [
        ("Lightweight", "Lightweight", True),
        ("Lightweight", "Featherweight", True),  # one class up or down is ordinary
        ("Welterweight", "Bantamweight", False),  # three classes apart: two different men with one name
        ("Women's Strawweight", "Women's Strawweight", True),
        ("Women's Flyweight", "Women's Bantamweight", True),
        ("Flyweight", "Women's Flyweight", False),  # never across men's and women's divisions
        ("Women's Flyweight", "Flyweight", False),
        (None, "Heavyweight", True),  # no division on one side: the name has to be enough
        ("Catchweight", "Lightweight", True),
    ],
)
def test_the_guards_against_two_people_with_one_name(ufc_division, org_division, linked):
    assert crossorg._linked(("Some Name", ufc_division), org_division) is linked


def test_the_prediction_model_never_reads_the_other_organizations():
    """The record and striking numbers the model uses come from the UFC catalog, and the pre-fight history from event_cards.csv.
    Showing a second history on the profile must not change either."""
    for module in ("prediction_service.py", "catalog_service.py", "events_service.py"):
        source = (Path(__file__).resolve().parents[2] / "backend" / "app" / "services" / module).read_text(encoding="utf-8")
        assert "crossorg" not in source and "org_service" not in source, f"{module} must not read the other organizations"

    events = pd.read_csv(RAW_DATA_DIR / "event_cards.csv", usecols=["event_name"])["event_name"].astype(str)
    assert not events.str.contains(r"\b(?:PFL|Bellator)\b", flags=re.IGNORECASE, regex=True).any()


def test_the_prediction_does_not_change_when_the_history_is_shown(client, monkeypatch):
    before = client.post("/predict", json={"fighter_a": PICO, "fighter_b": "Sean O'Malley"})
    assert before.status_code == 200
    client.get(f"/fighters/{PICO}/other-organizations")
    after = client.post("/predict", json={"fighter_a": PICO, "fighter_b": "Sean O'Malley"})
    assert after.json()["fighter_a_probability"] == before.json()["fighter_a_probability"]
