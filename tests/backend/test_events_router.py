def test_events_returns_list_sorted_most_recent_first(client):
    response = client.get("/events")
    assert response.status_code == 200
    events = response.json()
    assert len(events) > 10

    dates = [event["date"] for event in events if event["date"]]
    assert dates == sorted(dates, reverse=True)


def test_most_events_have_a_parsed_date(client):
    """Regression test: event_date must be parsed from a format ufcstats.com
    actually uses (full month names, e.g. "September 29, 2012"), not just
    the abbreviated form that happens to match 3-letter months like "May".
    A wrong format string silently left ~92% of events with date=None.
    """

    response = client.get("/events")
    events = response.json()
    with_date = [event for event in events if event["date"]]
    assert len(with_date) / len(events) > 0.9


def test_event_includes_fight_card_with_winner(client):
    response = client.get("/events")
    events = response.json()

    event_with_fights = next(event for event in events if event["fight_count"] > 0)
    assert len(event_with_fights["fights"]) == event_with_fights["fight_count"]

    fight = event_with_fights["fights"][0]
    assert fight["fighter_1"]
    assert fight["fighter_2"]
    assert fight["winner"] in {fight["fighter_1"], fight["fighter_2"], None}


def test_events_response_is_cacheable(client):
    response = client.get("/events")
    assert response.headers.get("cache-control") == "public, max-age=300"


def test_upcoming_events_are_sorted_soonest_first(client):
    response = client.get("/events/upcoming")
    assert response.status_code == 200
    events = response.json()
    assert len(events) > 0

    dates = [event["date"] for event in events if event["date"]]
    assert dates == sorted(dates)


def test_upcoming_events_have_no_winners_yet(client):
    response = client.get("/events/upcoming")
    events = response.json()
    for event in events:
        for fight in event["fights"]:
            assert fight["winner"] is None


def test_fights_carry_referee_rounds_title_flag_and_result_details(client):
    fights = [fight for event in client.get("/events").json() for fight in event["fights"]]
    detailed = [fight for fight in fights if fight["referee"]]

    # Nearly every historical fight is matched by fight_url to data/raw/fight_details.csv.
    assert len(detailed) / len(fights) > 0.95
    sample = detailed[0]
    assert sample["num_rounds"] in {1, 2, 3, 4, 5, None}
    assert isinstance(sample["title_fight"], bool)
    assert sample["result"]
    assert any(fight["title_fight"] is True for fight in fights)
    assert any(fight["result"] == "Decision - Unanimous" and "-" in (fight["result_details"] or "") for fight in fights)


def test_bmf_title_fights_are_flagged_even_though_the_belt_is_not_a_divisional_title(client):
    fights = [fight for event in client.get("/events").json() for fight in event["fights"]]
    bmf = [fight for fight in fights if fight["bmf_title"]]

    assert {(fight["fighter_1"], fight["fighter_2"]) for fight in bmf} >= {
        ("Charles Oliveira", "Max Holloway"),
        ("Max Holloway", "Justin Gaethje"),
        ("Jorge Masvidal", "Nate Diaz"),
    }
    assert all(fight["title_fight"] is False for fight in bmf)  # the source data does not count BMF fights as title fights

    upcoming = [fight for event in client.get("/events/upcoming").json() for fight in event["fights"]]
    oliveira_lopes = next(
        fight for fight in upcoming if {fight["fighter_1"], fight["fighter_2"]} == {"Charles Oliveira", "Diego Lopes"}
    )
    assert oliveira_lopes["bmf_title"] is True
    assert not oliveira_lopes["title_fight"]


def test_upcoming_fights_with_a_current_champion_are_flagged_as_title_fights(client):
    # Champions change and so do the cards, so derive the expectation from the current champions instead of naming fights.
    champions = {reign["division"]: reign["champion"] for reign in client.get("/champions").json()["current_champions"]}
    upcoming = client.get("/events/upcoming").json()
    fights = [fight for event in upcoming for fight in event["fights"]]
    assert fights

    for fight in fights:
        holder = champions.get(fight["weight_class"] or "")
        expected = holder in (fight["fighter_1"], fight["fighter_2"])
        # A fight is a title fight only when today's champion of that division is in it, even on a numbered event.
        assert bool(fight["title_fight"]) == expected, (fight["fighter_1"], fight["fighter_2"], fight["weight_class"])


def event(name, date, *pairs):
    return {"name": name, "date": date, "location": None, "fight_count": len(pairs), "event_url": None,
            "fights": [{"fighter_1": a, "fighter_2": b} for a, b in pairs]}


def manual_row(date="2026-12-05", a="Fighter One", b="Fighter Two", name="UFC Fight Night: Test"):
    return {"event_name": name, "event_date": date, "location": "", "fighter_1": a, "fighter_2": b, "weight_class": "Middleweight"}


def test_manual_fights_create_an_event_the_news_announced_before_espn(monkeypatch):
    from backend.app.services import events_service as service

    monkeypatch.setattr(service, "_current_champions", lambda: {})
    base = [event("UFC 999", "2026-12-12", ("Alpha One", "Beta Two"))]

    merged = service._merge_manual_fights(base, [manual_row()], today="2026-11-01")
    assert [item["date"] for item in merged] == ["2026-12-05", "2026-12-12"]  # kept in date order
    added = merged[0]
    assert added["fight_count"] == 1 and added["fights"][0]["fighter_1"] == "Fighter One"
    assert base[0]["fights"] and len(base) == 1  # the cached list is never modified


def test_a_manual_fight_retires_once_espn_lists_the_pairing_or_the_date_passes(monkeypatch):
    from backend.app.services import events_service as service

    monkeypatch.setattr(service, "_current_champions", lambda: {})
    listed = [event("UFC 999", "2026-12-05", ("Fighter Two", "Fighter One"))]  # same pairing, corners swapped

    assert service._merge_manual_fights(listed, [manual_row()], today="2026-11-01") == listed
    assert service._merge_manual_fights([], [manual_row()], today="2026-12-06") == []  # the date has passed


def test_a_manual_fight_joins_the_card_ESPN_already_has(monkeypatch):
    from backend.app.services import events_service as service

    monkeypatch.setattr(service, "_current_champions", lambda: {})
    base = [event("UFC Fight Night: Test", "2026-12-05", ("Alpha One", "Beta Two"))]

    merged = service._merge_manual_fights(base, [manual_row()], today="2026-11-01")
    assert len(merged) == 1 and merged[0]["fight_count"] == 2


def test_the_main_event_is_the_bout_the_card_is_named_after(client):
    # ESPN lists a card from the first prelim to the main event; the pages need the main event first.
    for event in client.get("/events/upcoming").json():
        if len(event["fights"]) < 2 or " vs" not in event["name"]:
            continue
        headline = event["name"].split(":", 1)[-1].lower()
        main = event["fights"][0]
        surnames = [name.split()[-1].lower() for name in (main["fighter_1"], main["fighter_2"])]
        named = any(surname in headline for surname in surnames)
        others_named = any(
            all(name.split()[-1].lower() in headline for name in (fight["fighter_1"], fight["fighter_2"])) for fight in event["fights"][1:]
        )
        assert named or not others_named, event["name"]


def test_main_event_first_orders_a_card_and_falls_back_to_the_last_bout():
    from backend.app.services import events_service as service

    named = event("UFC Fight Night: Buckley vs. Malott", "2030-01-01", ("Opener One", "Opener Two"), ("Erin Blanchfield", "Co Main"), ("Joaquin Buckley", "Mike Malott"))
    assert [(f["fighter_1"]) for f in service._main_event_first(named)["fights"]] == ["Joaquin Buckley", "Erin Blanchfield", "Opener One"]

    unnamed = event("UFC Fight Night: Special Card", "2030-01-01", ("Opener One", "Opener Two"), ("Middle A", "Middle B"), ("Headliner A", "Headliner B"))
    assert [(f["fighter_1"]) for f in service._main_event_first(unnamed)["fights"]] == ["Headliner A", "Middle A", "Opener One"]
    assert service._main_event_first(event("UFC 1: Solo", "2030-01-01", ("A", "B")))["fights"][0]["fighter_1"] == "A"
