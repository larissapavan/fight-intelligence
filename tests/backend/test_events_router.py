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
