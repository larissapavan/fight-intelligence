from datetime import date

import pytest

from scripts import scrape_fight_stats as stats
from scripts.scrape_espn import EspnBout, EspnEvent, EspnFighter


def payload(**values):
    return {"splits": {"categories": [{"name": "general", "stats": [{"name": k, "value": v} for k, v in values.items()]}]}}


FULL = payload(sigStrikesLanded=30.0, sigStrikesAttempted=60.0, takedownsLanded=2.0, takedownsAttempted=5.0, knockDowns=1.0, timeInControl=95.0, submissions=1.0)


def test_statistics_become_our_columns_and_an_empty_payload_means_no_numbers():
    numbers = stats.parse_statistics(FULL)
    assert numbers["sig_landed"] == 30 and numbers["sig_attempted"] == 60 and numbers["td_landed"] == 2
    assert numbers["knockdowns"] == 1 and numbers["control_seconds"] == 95 and numbers["submission_attempts"] == 1
    assert numbers["total_landed"] == 0  # a number ESPN leaves out counts as zero

    assert stats.parse_statistics(payload(sigStrikesLanded=0.0, sigStrikesAttempted=0.0)) is None  # not tracked for that fight
    assert stats.parse_statistics({}) is None and stats.parse_statistics({"splits": {}}) is None


def card(url, one, two, day="January 04, 2020"):
    return {"fight_url": url, "event_date": day, "fighter_1": one, "fighter_2": two}


def test_pending_fights_skip_what_is_done_the_future_and_fights_out_of_range():
    cards = [
        card("old", "A", "B", "January 04, 2020"), card("done", "C", "D", "January 04, 2020"),
        card("later", "E", "F", "March 07, 2021"), card("future", "G", "H", "January 01, 2999"), card("", "I", "J"),
    ]
    assert list(stats.pending_fights(cards, {"done"}, None, None)) == [date(2020, 1, 4), date(2021, 3, 7)]
    only = stats.pending_fights(cards, {"done"}, date(2021, 1, 1), None)
    assert [row["fight_url"] for rows in only.values() for row in rows] == ["later"]
    assert not stats.pending_fights(cards, set(), None, date(2019, 1, 1))


class FakeClient:
    def __init__(self, events, payloads):
        self.events, self.payloads, self.requests = events, payloads, []

    def scoreboard(self, since, until):
        self.requests.append(("scoreboard", since, until))
        return self.events

    def get_json(self, url, params=None):
        self.requests.append(("stats", url))
        for athlete, data in self.payloads.items():
            if f"/competitors/{athlete}/statistics" in url:
                return data
        raise RuntimeError("no such competitor")


def bout(competition, first, second, completed=True):
    return EspnBout(competition, "Lightweight", [EspnFighter(*first), EspnFighter(*second)], 0, completed)


def test_stats_are_attached_to_our_fighters_even_when_espn_lists_them_the_other_way_round():
    event = EspnEvent("9001", "UFC Test", date(2020, 1, 4), None, [bout("c1", ("201", "Beatriz Souza"), ("101", "Ann Alvarez"))])
    client = FakeClient([event], {"101": FULL, "201": payload(sigStrikesLanded=11.0, sigStrikesAttempted=40.0)})
    collector = stats.StatsCollector(client, delay=0)

    rows, unmatched = collector.collect_day(date(2020, 1, 4), [card("u1", "Ann Alvarez", "Beatriz Souza")])

    assert not unmatched
    ann, bea = rows
    assert (ann["fighter"], ann["opponent"], ann["espn_athlete_id"], ann["sig_landed"]) == ("Ann Alvarez", "Beatriz Souza", "101", "30")
    assert (bea["fighter"], bea["opponent"], bea["espn_athlete_id"], bea["sig_landed"]) == ("Beatriz Souza", "Ann Alvarez", "201", "11")
    assert ann["fight_url"] == bea["fight_url"] == "u1" and ann["espn_event_id"] == "9001" and ann["espn_competition_id"] == "c1"


def test_a_month_of_events_costs_one_scoreboard_call():
    event = EspnEvent("9001", "UFC Test", date(2020, 1, 4), None, [bout("c1", ("1", "Ann Alvarez"), ("2", "Beatriz Souza"))])
    client = FakeClient([event], {"1": FULL, "2": FULL})
    collector = stats.StatsCollector(client, delay=0)
    collector.collect_day(date(2020, 1, 4), [card("u1", "Ann Alvarez", "Beatriz Souza")])
    collector.collect_day(date(2020, 1, 25), [card("u2", "Nobody Here", "Nobody There")])
    assert sum(1 for kind, *_ in client.requests if kind == "scoreboard") == 1


def test_fights_espn_does_not_list_or_has_no_numbers_for_are_recorded_not_guessed():
    event = EspnEvent("9001", "UFC Test", date(2020, 1, 4), None, [
        bout("c1", ("1", "Ann Alvarez"), ("2", "Beatriz Souza")),
        bout("c2", ("3", "Cora Diaz"), ("4", "Dana Evans")),
        bout("c3", ("5", "Eve Fox"), ("6", "Fay Gil"), completed=False),
    ])
    client = FakeClient([event], {"1": FULL, "2": FULL, "3": payload(sigStrikesLanded=0.0), "4": payload(sigStrikesLanded=0.0)})
    rows, unmatched = stats.StatsCollector(client, delay=0).collect_day(date(2020, 1, 4), [
        card("good", "Ann Alvarez", "Beatriz Souza"), card("zeros", "Cora Diaz", "Dana Evans"),
        card("missing", "Gus Hall", "Hal Ivy"), card("unfinished", "Eve Fox", "Fay Gil"),
    ])
    assert {r["fight_url"] for r in rows} == {"good"}
    reasons = {u["fight_url"]: u["reason"] for u in unmatched}
    assert reasons == {"zeros": "ESPN has no numbers for it", "missing": "not on ESPN's scoreboard", "unfinished": "not on ESPN's scoreboard"}


def test_a_failed_request_for_one_fight_does_not_stop_the_event():
    event = EspnEvent("9001", "UFC Test", date(2020, 1, 4), None, [
        bout("c1", ("1", "Ann Alvarez"), ("2", "Beatriz Souza")), bout("c2", ("3", "Cora Diaz"), ("4", "Dana Evans")),
    ])
    client = FakeClient([event], {"1": FULL, "2": FULL})  # nothing for 3 and 4: the request raises
    rows, unmatched = stats.StatsCollector(client, delay=0).collect_day(date(2020, 1, 4), [
        card("good", "Ann Alvarez", "Beatriz Souza"), card("broken", "Cora Diaz", "Dana Evans")])
    assert {r["fight_url"] for r in rows} == {"good"} and [u["fight_url"] for u in unmatched] == ["broken"]


def test_rows_are_appended_with_one_header(tmp_path):
    path = tmp_path / "fight_stats.csv"
    row = {field: "" for field in stats.FIELDS} | {"fight_url": "u1", "fighter": "Ann Alvarez"}
    stats.append_rows(path, stats.FIELDS, [row])
    stats.append_rows(path, stats.FIELDS, [row | {"fight_url": "u2"}])
    stats.append_rows(path, stats.FIELDS, [])
    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines[0].startswith("fight_url,event_date,fighter") and len(lines) == 3
    assert [r["fight_url"] for r in stats.load_rows(path)] == ["u1", "u2"]
