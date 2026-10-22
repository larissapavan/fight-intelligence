from datetime import date

from backend.app.services.data_confidence import assess

TODAY = date(2026, 10, 21)


def fighter(name="A", fights=20, last="2026-06-01", age=30.0, height=180.0, reach=185.0):
    return {"name": name, "total_fights": fights, "ufc_last_fight": last, "age": age, "height_cm": height, "reach_cm": reach}


def test_two_active_veterans_with_full_data_are_solid():
    result = assess(fighter("A"), fighter("B"), today=TODAY)
    assert result == {"level": "solid", "label": "Solid data", "reasons": []}


def test_a_newcomer_makes_the_whole_matchup_thin():
    result = assess(fighter("Rookie", fights=2), fighter("Vet", fights=3, last="2026-09-01"), today=TODAY)
    assert result["level"] == "thin"
    assert any("Rookie has only 2 recorded fights" in reason for reason in result["reasons"])
    assert any("Vet has only 3" in reason for reason in result["reasons"])


def test_a_single_fight_reads_in_the_singular():
    result = assess(fighter("Debut", fights=1), fighter("B"), today=TODAY)
    assert "Debut has only 1 recorded fight," in result["reasons"][0]


def test_a_long_layoff_is_called_out_and_a_short_one_is_not():
    away = assess(fighter("Away", last="2024-08-01"), fighter("B"), today=TODAY)
    assert away["level"] == "some_gaps"
    assert "Away last fought in the UFC about 2 years ago" in away["reasons"][0]
    assert assess(fighter("Back", last="2026-01-01"), fighter("B"), today=TODAY)["level"] == "solid"


def test_a_missing_measurement_is_named():
    result = assess(fighter("A", reach=None), fighter("B", reach=None, height=None), today=TODAY)
    assert result["level"] == "some_gaps"
    assert "A has no reach on record" in result["reasons"][0]
    assert "B has no height or reach on record" in result["reasons"][1]


def test_an_unknown_last_fight_date_adds_nothing():
    assert assess(fighter("A", last=None), fighter("B", last=""), today=TODAY)["level"] == "solid"
