from datetime import date

import pytest

from scripts import scrape_espn as espn


def competitor(athlete_id, name, order, winner=False, record="10-2-0"):
    return {
        "id": str(athlete_id), "order": order, "winner": winner,
        "athlete": {"displayName": name}, "records": [{"summary": record}],
    }


def competition(comp_id, wc, a, b, completed=True, winner=None, period=3, clock="5:00"):
    return {
        "id": str(comp_id), "type": {"abbreviation": wc},
        "competitors": [
            competitor(*a, order=1, winner=winner == 0), competitor(*b, order=2, winner=winner == 1)
        ],
        "status": {"period": period, "displayClock": clock, "type": {"completed": completed}},
    }


def payload(name="UFC 999: Alpha vs. Beta", day="2026-11-07T20:00Z", comps=None, country="USA"):
    return {
        "events": [
            {
                "id": "1", "name": name, "date": day,
                "venues": [{"address": {"city": "Las Vegas", "state": "NV", "country": country}}],
                "competitions": comps or [],
            }
        ]
    }


def empty_tables(**overrides):
    base = dict(cards=[], fights=[], events=[], upcoming=[], fighters=[], career=[])
    base.update(overrides)
    return espn.Tables(**base)


def fighter_row(first, last, wins, losses, url="http://ufcstats.com/fighter-details/x"):
    return {"first_name": first, "last_name": last, "wins": str(wins), "losses": str(losses), "draws": "0", "fighter_url": url}


def no_result(event, bout):
    return ("KO/TKO", "Punches")


# --------------------------------------------------------------------------- pure helpers


def test_name_key_ignores_accents_case_and_order():
    assert espn.name_key("Zhang Tiequan") == espn.name_key("Tiequan Zhang")
    assert espn.name_key("Jiří Procházka") == espn.name_key("jiri prochazka")
    assert espn.ascii_name("Mantas Kondratavičius") == "Mantas Kondratavicius"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("W Strawweight", "Women's Strawweight"), ("Catchweight", "Catch Weight"), ("Lightweight", "Lightweight"), ("", "")],
)
def test_map_weight_class(raw, expected):
    assert espn.map_weight_class(raw) == expected


@pytest.mark.parametrize(
    ("result", "expected"),
    [
        ({"name": "kotko", "displayName": "KO/TKO", "displayDescription": "Punches"}, ("KO/TKO", "Punches")),
        ({"name": "submission", "displayDescription": "Arm Triangle"}, ("SUB", "Arm Triangle")),
        ({"name": "decision---unanimous"}, ("U-DEC", "")),
        ({"name": "decision---split"}, ("S-DEC", "")),
        ({"name": "decision---majority"}, ("M-DEC", "")),
        ({"name": "no-contest"}, ("Overturned", "")),
        ({"name": "tko---doctors-stoppage", "displayName": "TKO - Doctor's Stoppage"}, ("KO/TKO", "Doctor's Stoppage")),
        (None, ("", "")),
    ],
)
def test_map_result(result, expected):
    assert espn.map_result(result) == expected


def test_officials_and_scorecards_ignore_placeholders_and_bad_scores():
    referee, judges = espn.parse_officials({
        "items": [
            {"id": "1", "firstName": "Jerin", "lastName": "Valel", "position": {"name": "Referee"}, "order": 0},
            {"id": "2", "firstName": "Eric", "lastName": "Colon", "position": {"name": "Judge"}, "order": 1},
            {"id": "3", "firstName": "Judge", "lastName": "1", "position": {"name": "Judge"}, "order": 2},
            "not-a-judge",
        ]
    })
    assert referee == "Jerin Valel"
    assert judges == [("2", "Eric Colon")]
    scores = espn.parse_judge_scores({
        "items": [{"linescores": [
            {"value": 29, "official": {"$ref": "http://x/officials/2?lang=en"}},
            {"value": 99, "official": {"id": "9"}},
            {"value": "nope", "official": {"id": "2"}},
        ]}]
    })
    assert scores == {"2": 29}
    assert espn.format_scorecards(judges, {"2": 28}, {"2": 29}) == "Eric Colon 28 - 29."
    assert espn.format_scorecards(judges, {}, {"2": 29}) == ""
    assert espn.parse_officials(None) == ("", [])
    assert espn.scheduled_rounds({"format": {"regulation": {"periods": 5}}}) == "5"
    assert espn.scheduled_rounds({"format": {"regulation": {"periods": 12}}}) == ""
    assert espn.clean_clock("4:19") == "4:19" and espn.clean_clock("tomorrow") == ""


def test_format_location_expands_us_states_and_skips_state_abroad():
    assert espn.format_location({"address": {"city": "Las Vegas", "state": "NV", "country": "USA"}}) == "Las Vegas, Nevada, USA"
    assert espn.format_location({"address": {"city": "Doha", "state": "", "country": "Qatar"}}) == "Doha, Qatar"


def test_same_pair_tolerates_spelling_variants_but_not_other_opponents():
    assert espn.same_pair("Cody Chovancek", "SuYoung You", "Cody Chovancek", "You Su-young")
    assert espn.same_pair("Ilimbek Akylbek", "Mahammadali Osmanli", "Mehemmedeli Osmanli", "Ilimbek Akylbek Uulu")
    assert not espn.same_pair("Julien Leblanc", "Gilbert Urbina", "Julien LeBlanc", "Nick Galanti")


# --------------------------------------------------------------------------- scoreboard parsing


def test_parse_scoreboard_skips_tba_and_contender_series_and_reads_winner():
    comps = [
        competition(10, "Lightweight", (1, "Alpha One"), (2, "Beta Two"), winner=1),
        competition(11, "Welterweight", (3, "Gamma Three"), (4, "TBA"), completed=False),
    ]
    events = espn.parse_scoreboard(payload(comps=comps))
    assert len(events) == 1 and len(events[0].bouts) == 1
    bout = events[0].bouts[0]
    assert bout.winner_index == 1 and bout.fighters[0].record == (10, 2, 0)
    assert espn.parse_scoreboard(payload(name="Dana White's Contender Series: Season 10, Week 1", comps=comps)) == []


def test_event_day_shifts_early_utc_start_in_the_americas_only():
    assert espn.event_day("2026-10-04T02:00Z", {"address": {"country": "USA"}}) == date(2026, 10, 3)
    assert espn.event_day("2026-10-04T02:00Z", {"address": {"country": "Australia"}}) == date(2026, 10, 4)


# --------------------------------------------------------------------------- completed events


def completed_event():
    comps = [competition(10, "Lightweight", (1, "Alpha One"), (2, "Beta Two"), winner=1, period=2, clock="3:15")]
    return espn.parse_scoreboard(payload(comps=comps))[0]


def test_sync_completed_event_keeps_the_announced_order_and_is_idempotent():
    tables = empty_tables(
        fighters=[fighter_row("Alpha", "One", 10, 2), fighter_row("Beta", "Two", 11, 1)],
        upcoming=[{
            "event_name": "UFC 999: Alpha vs. Beta", "event_date": "November 07, 2026",
            "event_url": "http://ufcstats.com/event-details/abc", "fight_url": "http://ufcstats.com/fight-details/1",
            "fighter_1": "Alpha One", "fighter_2": "Beta Two",
        }],
    )
    report = espn.Report()
    catalog = espn.Catalog(tables.fighters)
    espn.sync_completed_event(completed_event(), tables, catalog, no_result, report)

    row = tables.cards[0]
    assert (row["fighter_1"], row["fighter_2"], row["winner"]) == ("Alpha One", "Beta Two", "Beta Two")
    assert (row["method"], row["method_detail"], row["round"], row["time"]) == ("KO/TKO", "Punches", "2.0", "3:15")
    assert row["event_url"] == "http://ufcstats.com/event-details/abc"
    assert row["fight_url"] == "http://ufcstats.com/fight-details/1"
    assert tables.fights[0]["fight_url"] == "http://ufcstats.com/fight-details/1"
    assert tables.details[0]["referee"] == "" and tables.details[0]["result"] == "KO/TKO"
    assert tables.details[0]["result_details"] == "Punches"
    assert tables.events[0]["event_url"] == "http://ufcstats.com/event-details/abc"
    assert tables.upcoming == []

    espn.sync_completed_event(completed_event(), tables, catalog, no_result, espn.Report())
    assert len(tables.cards) == 1 and len(tables.fights) == 1 and len(tables.events) == 1
    assert len(tables.details) == 1


def test_sync_completed_event_only_adds_missing_bouts_to_an_existing_event():
    existing = {
        "event_name": "UFC 999: Alpha vs. Beta", "event_date": "November 07, 2026", "location": "Las Vegas, Nevada, USA",
        "event_url": "http://ufcstats.com/event-details/abc", "fight_url": "http://ufcstats.com/fight-details/1",
        "fighter_1": "Beta Two", "fighter_2": "Alpha One", "winner": "Beta Two",
    }
    tables = empty_tables(cards=[existing])
    comps = [
        competition(10, "Lightweight", (1, "Alpha One"), (2, "Beta Two"), winner=1),
        competition(11, "Welterweight", (3, "Gamma Three"), (4, "Delta Four"), winner=0),
    ]
    event = espn.parse_scoreboard(payload(comps=comps))[0]
    report = espn.Report()
    espn.sync_completed_event(event, tables, espn.Catalog([]), no_result, report)

    assert len(tables.cards) == 2 and report.bouts_added == 1
    assert tables.cards[1]["event_url"] == "http://ufcstats.com/event-details/abc"
    assert tables.events == []


def test_decision_scorecards_use_the_announced_corner_order():
    def detail(event, bout):
        return espn.BoutDetail(
            method="U-DEC", referee="Jerin Valel", num_rounds="3", result="Decision - Unanimous",
            judges=[("2", "Eric Colon"), ("9", "Missing Card")],
            scores={"1": {"2": 28}, "2": {"2": 29}},
        )

    tables = empty_tables(upcoming=[{
        "event_name": "UFC 999: Alpha vs. Beta", "event_date": "November 07, 2026",
        "fight_url": "http://ufcstats.com/fight-details/9", "fighter_1": "Alpha One", "fighter_2": "Beta Two",
    }])
    espn.sync_completed_event(completed_event(), tables, espn.Catalog([]), detail, espn.Report())
    saved = tables.details[0]
    assert saved["referee"] == "Jerin Valel"
    assert saved["result"] == "Decision - Unanimous"
    assert saved["result_details"] == "Eric Colon 28 - 29."
    assert saved["num_rounds"] == "3"


def test_a_fight_without_a_stats_url_still_stores_the_referee():
    tables = empty_tables(upcoming=[{
        "event_name": "UFC 999: Alpha vs. Beta", "event_date": "November 07, 2026",
        "fight_url": "", "fighter_1": "Alpha One", "fighter_2": "Beta Two",
    }])

    def detail(event, bout):
        return espn.BoutDetail(method="KO/TKO", method_detail="Knee", referee="Marc Goddard", result="KO/TKO")

    espn.sync_completed_event(completed_event(), tables, espn.Catalog([]), detail, espn.Report())
    assert tables.cards[0]["fight_url"] == "https://www.espn.com/mma/fightcenter/_/id/10"
    assert tables.details[0]["referee"] == "Marc Goddard"
    assert tables.details[0]["result_details"] == "Knee"

    espn.sync_completed_event(completed_event(), tables, espn.Catalog([]), detail, espn.Report())
    assert len(tables.cards) == 1 and len(tables.details) == 1


def test_a_bad_bout_payload_does_not_drop_the_announced_fight():
    tables = empty_tables(upcoming=[{
        "event_name": "UFC 999: Alpha vs. Beta", "event_date": "November 07, 2026",
        "fight_url": "http://ufcstats.com/fight-details/9", "fighter_1": "Alpha One", "fighter_2": "Beta Two",
    }])

    def boom(event, bout):
        raise ValueError("unexpected shape")

    report = espn.Report()
    espn.sync_completed_event(completed_event(), tables, espn.Catalog([]), boom, report)
    assert tables.cards == []
    assert tables.upcoming[0]["fight_url"] == "http://ufcstats.com/fight-details/9"
    assert report.detail_skipped


# --------------------------------------------------------------------------- upcoming events


def test_sync_upcoming_event_keeps_ufcstats_rows_adds_new_and_drops_only_conflicts():
    meta = {"event_name": "UFC 999: Alpha vs. Beta", "event_date": "November 07, 2026", "location": "Las Vegas, Nevada, USA", "event_url": "http://ufcstats.com/event-details/abc"}
    kept = {**meta, "fight_url": "http://ufcstats.com/fight-details/1", "fighter_1": "Alpha One", "fighter_2": "Beta Two", "weight_class": "Lightweight"}
    stale = {**meta, "fight_url": "http://ufcstats.com/fight-details/2", "fighter_1": "Gamma Three", "fighter_2": "Old Rival", "weight_class": "Welterweight"}
    extra = {**meta, "fight_url": "http://ufcstats.com/fight-details/3", "fighter_1": "Solo Fighter", "fighter_2": "Other Solo", "weight_class": "Flyweight"}
    tables = empty_tables(upcoming=[kept, stale, extra])
    comps = [
        competition(10, "Lightweight", (1, "Alpha One"), (2, "Beta Two"), completed=False),
        competition(11, "Welterweight", (3, "Gamma Three"), (4, "Brand Opponent"), completed=False),
    ]
    event = espn.parse_scoreboard(payload(comps=comps))[0]
    report = espn.Report()
    espn.sync_upcoming_event(event, tables, espn.Catalog([]), report)

    pairs = [(r["fighter_1"], r["fighter_2"], r["fight_url"]) for r in tables.upcoming]
    assert ("Alpha One", "Beta Two", "http://ufcstats.com/fight-details/1") in pairs
    assert ("Gamma Three", "Brand Opponent", "") in pairs
    assert ("Solo Fighter", "Other Solo", "http://ufcstats.com/fight-details/3") in pairs
    assert not any(p[1] == "Old Rival" for p in pairs)
    assert report.upcoming_bouts_added == 1 and len(report.upcoming_bouts_dropped) == 1


def test_prune_upcoming_removes_events_espn_no_longer_lists():
    row = {"event_name": "UFC Fight Night 295", "event_date": "November 28, 2026", "fighter_1": "A One", "fighter_2": "B Two"}
    tables = empty_tables(upcoming=[row])
    report = espn.Report()
    espn.prune_upcoming([], tables, date(2026, 10, 1), date(2027, 1, 1), report)
    assert tables.upcoming == [] and report.upcoming_events_pruned


# --------------------------------------------------------------------------- catalog / fighters


def test_catalog_matches_exact_fuzzy_and_flags_homonyms():
    catalog = espn.Catalog(
        [
            fighter_row("Jose", "Delgado", 12, 2, "u1"),
            fighter_row("Michael", "Aswell Jr.", 11, 5, "u2"),
            fighter_row("Anthony", "Romero", 8, 0, "u3"),
        ]
    )
    assert catalog.find(espn.EspnFighter("1", "Jose Delgado", (12, 2, 0))) [1] == "exact"
    assert catalog.find(espn.EspnFighter("2", "Jose Miguel Delgado", (13, 2, 0))) [1] == "fuzzy"
    assert catalog.find(espn.EspnFighter("3", "Michael Aswell", (12, 5, 0))) [1] == "fuzzy"
    assert catalog.find(espn.EspnFighter("4", "Anthony Romero", (12, 3, 0))) [1] == "ambiguous"
    assert catalog.find(espn.EspnFighter("5", "Brand New", (1, 0, 0))) [1] == "new"


def test_create_fighter_builds_fighters_and_career_rows_from_the_espn_profile():
    tables = empty_tables()
    catalog = espn.Catalog(tables.fighters, tables.career)
    athlete = {
        "firstName": "Roberto", "lastName": "Soldić", "displayHeight": "5' 11\"", "displayWeight": "170 lbs",
        "reach": 73, "stance": {"text": "Southpaw"}, "dateOfBirth": "1994-11-02T08:00Z", "slug": "roberto-soldic",
    }
    report = espn.Report()
    espn.create_fighter(espn.EspnFighter("4274796", "Roberto Soldic", (22, 4, 0)), tables, catalog, lambda _id: athlete, report)

    row = tables.fighters[0]
    assert (row["first_name"], row["last_name"], row["weight"], row["reach"], row["stance"]) == ("Roberto", "Soldic", "170 lbs.", '73.0"', "Southpaw")
    assert row["fighter_url"] == "https://www.espn.com.br/mma/fighter/_/id/4274796/roberto-soldic"
    assert tables.career[0]["dob"] == "Nov 02, 1994" and tables.career[0]["sig_str_acc"] == "--"
    assert len(tables.fighters) == 1  # not appended twice (Catalog shares the list)
    assert catalog.find(espn.EspnFighter("4274796", "Roberto Soldic", (22, 4, 0))) [1] == "created"


def test_refresh_records_only_advances_along_espn_timeline():
    tables = empty_tables(
        fighters=[fighter_row("Alpha", "One", 10, 2, "u1"), fighter_row("Beta", "Two", 20, 5, "u2")],
        career=[{"fighter_url": "u1", "wins": "10", "losses": "2", "draws": "0"}, {"fighter_url": "u2", "wins": "20", "losses": "5", "draws": "0"}],
    )
    comps = [competition(10, "Lightweight", (1, "Alpha One", ), (2, "Beta Two"), winner=0)]
    comps[0]["competitors"][0]["records"] = [{"summary": "11-2-0"}]  # Alpha won: 10-2 -> 11-2
    comps[0]["competitors"][1]["records"] = [{"summary": "19-6-0"}]  # Beta lost; ESPN baseline (19-5) disagrees with ours (20-5)
    event = espn.parse_scoreboard(payload(comps=comps))[0]
    report = espn.Report()
    espn.refresh_records([event], tables, espn.Catalog(tables.fighters, tables.career), report)

    assert (tables.fighters[0]["wins"], tables.career[0]["wins"]) == ("11", "11")
    assert (tables.fighters[1]["wins"], tables.career[1]["wins"]) == ("20", "20")
    assert report.records_updated == 1 and len(report.record_skipped) == 1


def test_refresh_problem_rejects_an_empty_scoreboard_a_shrinking_roster_and_a_half_bout():
    roster = [fighter_row("Alpha", "One", 1, 0)]
    upcoming = [{"event_name": "UFC 1", "fighter_1": "Alpha One", "fighter_2": "Beta Two"} for _ in range(5)]
    before = empty_tables(fighters=roster, upcoming=upcoming)
    finished = espn.EspnBout("1", "Lightweight", [], None, True)
    past = espn.EspnEvent("1", "UFC 1", date(2026, 10, 1), None, [finished])

    assert "no events" in espn.refresh_problem(before, before, [])
    assert "shrank" in espn.refresh_problem(before, empty_tables(fighters=[], upcoming=upcoming), [past])
    collapsed = empty_tables(fighters=roster, upcoming=[])
    assert "upcoming cards dropped" in espn.refresh_problem(before, collapsed, [past])
    half = empty_tables(fighters=roster, upcoming=[{"event_name": "UFC 1", "fighter_1": "Alpha One", "fighter_2": ""}])
    assert "missing a fighter" in espn.refresh_problem(before, half, [past])


def test_weight_overrides_fix_a_bout_espn_books_in_the_wrong_division():
    rows = [
        {"fighter_1": "Lucia Szabova", "fighter_2": "Tainara Lisboa", "weight_class": "Women's Flyweight"},
        {"fighter_1": "Other One", "fighter_2": "Other Two", "weight_class": "Lightweight"},
    ]
    override = [{"fighter_1": "Tainara Lisboa", "fighter_2": "Lucia Szabova", "weight_class": "Women's Bantamweight"}]
    espn.apply_weight_overrides(rows, override)
    assert [r["weight_class"] for r in rows] == ["Women's Bantamweight", "Lightweight"]
