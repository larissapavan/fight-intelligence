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
