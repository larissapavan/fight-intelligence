"""The Bellator collector's parsers, run against small answers that copy the shape of ESPN's and Wikipedia's."""

from __future__ import annotations

from datetime import date

import pytest

from scripts import scrape_bellator as bel


def competitor(athlete_id, name, order, winner=False, record="10-2-0", flag="USA"):
    return {"id": athlete_id, "order": order, "winner": winner, "athlete": {"displayName": name, "flag": {"alt": flag}}, "records": [{"summary": record}]}


def competition(comp_id, fighters, *, completed=True, period=3, clock="5:00"):
    return {
        "id": comp_id, "competitors": fighters, "format": {"regulation": {"periods": 3}},
        "status": {"period": period, "displayClock": clock, "type": {"completed": completed}},
    }


def scoreboard(*competitions, date_text="2023-02-04T23:00Z"):
    return {"events": [{"id": "600", "name": "Bellator 290: Bader vs. Fedor 2", "date": date_text, "venues": [{"address": {"city": "Inglewood", "state": "CA", "country": "USA"}}], "competitions": list(competitions)}]}


def test_events_list_the_main_event_first_with_winner_round_and_time():
    payload = scoreboard(
        competition("1", [competitor("a", "Prelim One", 1), competitor("b", "Prelim Two", 2, winner=True)]),
        competition("2", [competitor("c", "Ryan Bader", 1, winner=True, record="31-8-0"), competitor("d", "Fedor Emelianenko", 2)], period=1, clock="2:30"),
    )
    [event] = bel.parse_events(payload)
    assert event["name"] == "Bellator 290: Bader vs. Fedor 2" and event["location"] == "Inglewood, CA, USA"
    assert event["day"] == date(2023, 2, 4)  # 23:00 UTC is the afternoon in California
    main, prelim = event["bouts"]
    assert [fighter["name"] for fighter in main["fighters"]] == ["Ryan Bader", "Fedor Emelianenko"]
    assert (main["winner_index"], main["round"], main["time"]) == (0, "1.0", "2:30")
    assert prelim["winner_index"] == 1 and prelim["fighters"][0]["record"] == "10-2-0"


def test_an_evening_card_in_the_americas_keeps_its_local_date():
    event = bel.parse_events(scoreboard(competition("1", [competitor("a", "A One", 1), competitor("b", "B Two", 2)]), date_text="2023-02-05T02:00Z"))[0]
    assert event["day"] == date(2023, 2, 4)


def test_placeholder_and_incomplete_bouts_are_skipped():
    payload = scoreboard(
        competition("1", [competitor("a", "TBA", 1), competitor("b", "B Two", 2)]),
        {"id": "2", "competitors": [competitor("c", "Only One", 1)]},
        competition("3", [competitor("d", "D Four", 1), competitor("e", "E Five", 2)], completed=False),
    )
    [event] = bel.parse_events(payload)
    assert [bout["competition_id"] for bout in event["bouts"]] == ["3"]
    assert event["bouts"][0]["completed"] is False


@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ({"result": {"displayName": "Decision - Unanimous"}}, ("U-DEC", "")),
        ({"result": {"displayName": "Unanimous Decision"}}, ("U-DEC", "")),
        ({"result": {"displayName": "Split Decision"}}, ("S-DEC", "")),
        ({"result": {"displayName": "Decision - Majority (Draw)"}}, ("M-DEC", "")),
        ({"result": {"displayName": "KO/TKO"}}, ("KO/TKO", "")),
        ({"result": {"displayName": "TKO (Punches)"}}, ("KO/TKO", "Punches")),
        ({"result": {"displayName": "TKO - Doctor's Stoppage"}}, ("KO/TKO", "Doctor's Stoppage")),
        ({"result": {"displayName": "Submission (Rear Naked Choke)"}}, ("SUB", "Rear Naked Choke")),
        ({"result": {"displayName": "Technical Submission (Rear-Naked Choke)"}}, ("SUB", "Rear-Naked Choke")),
        ({"result": {"displayName": "No Contest"}}, ("NO CONTEST", "")),
        ({"result": {"displayName": "Draw"}}, ("Draw", "")),
        ({}, ("", "")),
    ],
)
def test_the_method_is_written_like_the_ufc_data(status, expected):
    assert bel.parse_bout_method(status) == expected


def test_outcomes_cover_wins_draws_no_contests_and_bouts_to_come():
    bout = {"fighters": [{"name": "A"}, {"name": "B"}], "winner_index": 1, "completed": True}
    assert bel.bout_outcome(bout, "U-DEC") == ("B", "win")
    assert bel.bout_outcome({**bout, "winner_index": None}, "M-DEC") == ("", "draw")
    assert bel.bout_outcome({**bout, "winner_index": None}, "Draw") == ("", "draw")
    assert bel.bout_outcome({**bout, "winner_index": None}, "") == ("", "no_contest")
    assert bel.bout_outcome({**bout, "winner_index": None, "completed": False}, "") == ("", "")


def test_an_athlete_profile_is_converted_to_the_columns_the_site_uses():
    bio = bel.parse_athlete({
        "nickname": "The Wolf", "age": 38, "height": 70.0, "weight": 135.0, "reach": 73.0, "citizenship": "USA", "active": True,
        "association": {"name": "Kill Cliff FC", "location": {"city": "Rahway", "country": "USA"}},
        "weightClass": {"text": "Bantamweight"}, "headshot": {"href": "https://x/h.png"},
    })
    assert bio == {
        "nickname": "The Wolf", "age": 38, "height_cm": 177.8, "weight_lbs": 135.0, "reach_cm": 185.4, "country": "United States",
        "country_code": "us", "camp": "Kill Cliff FC", "fighting_out_of": "Rahway, USA", "weight_class": "Bantamweight",
        "headshot_url": "https://x/h.png", "active": True,
    }
    assert bel.parse_athlete({}) == {}


WIKI = """
<h3>Heavyweight World Championship</h3>
<table class="wikitable">
<tr><th>No.</th><th>Name</th><th>Event</th><th>Date</th><th>Reign</th><th>Defenses</th></tr>
<tr><td>1</td><td>Cole Konrad def. Neil Grove</td><td>Bellator 32</td><td>Oct 14, 2010</td><td>699 days</td><td>1. def. Eric Prindle at Bellator 70 on May 25, 2012</td></tr>
<tr><td colspan="6">Konrad vacated the title on September 12, 2012 when he retired.</td></tr>
<tr><td>2</td><td>Ryan Bader def. Fedor Emelianenko</td><td>Bellator 214</td><td>Jan 26, 2019</td><td>2,251 days</td><td>NC. vs. Cheick Kongo at Bellator 226 on Sep 7, 2019</td></tr>
<tr><td>—</td><td>Valentin Moldavsky def. Timothy Johnson for interim title</td><td>Bellator 261</td><td>Jun 25, 2021</td><td>—</td><td></td></tr>
<tr><td colspan="6">Bader was released from Bellator on March 26, 2025.</td></tr>
</table>
<h3>Flyweight World Championship</h3>
<h3>Middleweight World Championship</h3>
<table class="wikitable">
<tr><th>No.</th><th>Name</th><th>Event</th><th>Date</th><th>Reign</th><th>Defenses</th></tr>
<tr><td>1</td><td>Gegard Mousasi def. Douglas Lima</td><td>Bellator 250</td><td>Oct 29, 2020</td><td>604 days</td><td></td></tr>
<tr><td>2</td><td>Gegard Mousasi (2)</td><td>Bellator 264</td><td>Aug 1, 2021</td><td>1 days</td><td></td></tr>
<tr><td colspan="6">Mousasi vacated the title on October 1, 2022 after moving up.</td></tr>
<tr><td>3</td><td>New Guy</td><td>Bellator Champions Series 1</td><td>Mar 22, 2024</td><td>5 days</td><td></td></tr>
</table>
<h3>Bellator Fighting Championships: Season One</h3>
<table class="wikitable"><tr><th>Division</th></tr><tr><td>Welterweight [2]</td></tr></table>
"""


def test_reigns_are_read_from_the_tables_under_their_own_headings():
    reigns = bel.parse_reigns(WIKI)
    assert [(r["division"], r["champion"], r["interim"]) for r in reigns] == [
        ("Heavyweight", "Cole Konrad", False), ("Heavyweight", "Ryan Bader", False), ("Heavyweight", "Valentin Moldavsky", True),
        ("Middleweight", "Gegard Mousasi", False), ("Middleweight", "Gegard Mousasi", False), ("Middleweight", "New Guy", False),
    ]
    konrad, bader = reigns[0], reigns[1]
    assert konrad["fights"] == [(date(2010, 10, 14), "Cole Konrad", "Neil Grove"), (date(2012, 5, 25), "Cole Konrad", "Eric Prindle")]
    assert konrad["ended"] == date(2012, 9, 12)
    assert bader["fights"] == [(date(2019, 1, 26), "Ryan Bader", "Fedor Emelianenko"), (date(2019, 9, 7), "Ryan Bader", "Cheick Kongo")]
    assert reigns[2]["fights"] == [(date(2021, 6, 25), "Valentin Moldavsky", "Timothy Johnson")]
    assert reigns[2]["ended"] == date(2025, 3, 26)  # the note under the last row, dated long after Bellator closed


def test_the_champions_are_the_ones_holding_the_belt_when_bellator_ended():
    rows = bel.final_champions(bel.parse_reigns(WIKI), date(2023, 12, 31))
    by_division = {}
    for row in rows:
        by_division.setdefault(row["category"], []).append((row["fighter"], row["status"]))
    # Bader's release (2025) and the third middleweight reign (2024) are after the cutoff: they do not count.
    assert by_division["Heavyweight"] == [("Ryan Bader", "champion"), ("Valentin Moldavsky", "interim")]
    # Mousasi vacated in 2022, before the cutoff, and nobody won it before Bellator ended.
    assert by_division["Middleweight"] == [("", "vacant")]
    assert all(row["rank"] == 0 and row["is_p4p"] is False for row in rows)


def fight(a, b, day, **extra):
    return {"fighter_1": a, "fighter_2": b, "event_date": day, "weight_class": "", "stage": "", "title_fight": "", **extra}


def test_title_bouts_are_flagged_by_date_and_names_even_when_spelled_differently():
    reigns = bel.parse_reigns(WIKI)
    fights = [
        fight("Ryan Bader", "Fedor Emelianenko", "2019-01-26"),
        fight("Cheick Kongo", "Ryan Bader", "2019-09-08"),  # a day off (time zones), corners swapped
        fight("Ryan Bader", "Somebody Else", "2019-01-26"),
        fight("Valentin Moldavsky", "Timothy Johnson", "2021-06-25"),
    ]
    assert bel.mark_title_fights(fights, reigns) == 3
    assert [f["title_fight"] for f in fights] == ["true", "true", "", "true"]
    assert [f["weight_class"] for f in fights] == ["Heavyweight", "Heavyweight", "", "Heavyweight"]
    assert [f["stage"] for f in fights] == ["World Title", "World Title", "", "Interim World Title"]


def test_initials_are_spelled_the_same_in_both_sources():
    assert bel.compact_key("A. J. McKee") == bel.compact_key("AJ McKee")
    assert bel.compact_key("Patrício Pitbull") == bel.compact_key("Patricio Pitbull")
    assert bel.compact_key("Ana Silva") != bel.compact_key("Ana Costa")


def test_a_bout_takes_the_division_both_profiles_agree_on():
    bios = {"1": {"weight_class": "Lightweight"}, "2": {"weight_class": "Lightweight"}, "3": {"weight_class": "Welterweight"}}
    ids = {bel.name_key(name): ident for name, ident in {"Ana": "1", "Bia": "2", "Caio": "3"}.items()}
    fights = [fight("Ana", "Bia", "2020-01-01"), fight("Ana", "Caio", "2020-01-01"), fight("Ana", "Bia", "2020-01-01", weight_class="Featherweight")]
    assert bel.fill_weight_classes(fights, bios, ids) == 1
    assert [f["weight_class"] for f in fights] == ["Lightweight", "", "Featherweight"]


def test_fight_rows_keep_card_order_and_only_report_results_for_fought_bouts():
    events = bel.parse_events(scoreboard(
        competition("1", [competitor("a", "Prelim One", 1), competitor("b", "Prelim Two", 2, winner=True)], completed=True),
        competition("2", [competitor("c", "Main One", 1), competitor("d", "Main Two", 2)], completed=False),
    ))
    rows = bel.fight_rows(events, {"1": ("KO/TKO", "Punches")})
    assert [(r["card_order"], r["fighter_1"]) for r in rows] == [(0, "Main One"), (1, "Prelim One")]
    assert (rows[0]["outcome"], rows[0]["method"], rows[0]["round"]) == ("", "", "")
    assert (rows[1]["winner"], rows[1]["method"], rows[1]["method_detail"], rows[1]["round"], rows[1]["time"]) == ("Prelim Two", "KO/TKO", "Punches", "3", "5:00")
    assert rows[0]["event_slug"] == "bellator-600" and rows[0]["fight_url"].endswith("#fight-2")


def test_fighter_rows_have_unique_slugs_a_record_and_their_fight_dates():
    fighters = {"1": {"name": "Ana Silva", "flag": "Brazil", "record": "10-2-1"}, "2": {"name": "Ana Silva", "flag": "USA", "record": ""}}
    rows = bel.fighter_rows(fighters, {"1": {"active": True, "nickname": "The Arm"}}, [fight("Ana Silva", "X", "2020-01-02"), fight("Y", "Ana Silva", "2018-05-06")], "2026-10-21")
    first, second = rows
    assert (first["slug"], second["slug"]) == ("ana-silva", "ana-silva-2")
    assert (first["wins"], first["losses"], first["draws"], first["status"], first["nickname"]) == (10, 2, 1, "active", "The Arm")
    assert (first["country_code"], first["country"]) == ("br", "Brazil")
    assert (first["first_fight_date"], first["last_fight_date"]) == ("2018-05-06", "2020-01-02")
    assert second["wins"] == "" and second["status"] == "inactive"


def test_a_bout_takes_the_division_its_fighters_usually_fight_at():
    fights = [
        fight("Ana", "Bia", "2019-01-01", weight_class="Lightweight"),
        fight("Ana", "Caio", "2019-02-01", weight_class="Lightweight"),
        fight("Bia", "Dora", "2019-03-01", weight_class="Lightweight"),
        fight("Ana", "Dora", "2020-01-01"),        # both usually Lightweight
        fight("Ana", "Zed", "2020-02-01"),         # only Ana is known
        fight("Zed", "Yan", "2020-03-01"),         # nobody is known
        fight("Eli", "Fay", "2020-04-01", weight_class="Flyweight"),
        fight("Eli", "Fay", "2020-05-01", weight_class="Bantamweight"),
        fight("Eli", "Ana", "2020-06-01"),         # Eli is 50/50: not trusted; Ana alone decides
        fight("Eli", "Fay", "2020-07-01"),         # both 50/50: nobody trusted
    ]
    assert bel.propagate_weight_classes(fights) == 3
    assert [f["weight_class"] for f in fights[3:6]] == ["Lightweight", "Lightweight", ""]
    assert fights[8]["weight_class"] == "Lightweight" and fights[9]["weight_class"] == ""
