from xml.etree import ElementTree as ET

import pandas as pd

from backend.app.services.track_record_service import LOG_COLUMNS
from scripts import build_feed


def row(event, day, one, two, pick, confidence, winner="", correct="", resolved=""):
    return {
        "fight_key": f"{day}|{one}|{two}", "event_name": event, "event_date": day, "fighter_1": one, "fighter_2": two,
        "prob_fighter_1": confidence, "predicted_winner": pick, "confidence": confidence, "logged_at": "2026-10-15",
        "winner": winner, "correct": correct, "resolved_at": resolved,
    }


def feed_items(log):
    root = ET.fromstring(build_feed.build_feed(pd.DataFrame(log, columns=LOG_COLUMNS)))
    return root.find("channel"), root.findall("channel/item")


def test_an_upcoming_card_becomes_an_item_with_every_pick():
    log = [row("UFC 900", "2026-11-07", "Ann", "Bea", "Ann", 0.64), row("UFC 900", "2026-11-07", "Cat", "Dee", "Dee", 0.71)]
    _, items = feed_items(log)
    assert [i.findtext("title") for i in items] == ["Picks for UFC 900 (2026-11-07)"]
    text = items[0].findtext("description")
    assert "Ann vs. Bea: the model picks Ann (64%)" in text and "Cat vs. Dee: the model picks Dee (71%)" in text


def test_a_settled_card_becomes_a_results_item_with_its_biggest_miss():
    log = [
        row("UFC 899", "2026-10-17", "Ann", "Bea", "Ann", 0.9, winner="Bea", correct="False", resolved="2026-10-21"),
        row("UFC 899", "2026-10-17", "Cat", "Dee", "Cat", 0.6, winner="Cat", correct="True", resolved="2026-10-21"),
    ]
    _, items = feed_items(log)
    assert items[0].findtext("title") == "Results: UFC 899 (2026-10-17)"
    assert items[0].findtext("description") == "The model got 1 of 2 right.\nBiggest miss: Ann at 90%, but Bea won."


def test_a_card_with_one_fight_left_is_still_picks_and_the_newest_comes_first():
    log = [
        row("UFC 899", "2026-10-17", "Ann", "Bea", "Ann", 0.6, winner="Ann", correct="True", resolved="2026-10-21"),
        row("UFC 900", "2026-11-07", "Cat", "Dee", "Cat", 0.6),
    ]
    _, items = feed_items(log)
    # the results were settled on 2026-10-21, the picks were logged on 2026-10-15: newest first
    assert [i.findtext("title") for i in items] == ["Results: UFC 899 (2026-10-17)", "Picks for UFC 900 (2026-11-07)"]
    assert all(i.find("guid").get("isPermaLink") == "false" and i.findtext("pubDate") for i in items)


def test_an_empty_log_is_a_valid_empty_feed():
    channel, items = feed_items([])
    assert items == [] and channel.findtext("title").startswith("Fight Intelligence")
