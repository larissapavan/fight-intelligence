from backend.app.services.fight_history_service import get_fights_for_fighter


def test_champions_returns_current_champions_and_records(client):
    response = client.get("/champions")
    assert response.status_code == 200
    body = response.json()

    assert len(body["current_champions"]) > 0
    for reign in body["current_champions"]:
        assert reign["is_current"] is True
        assert reign["days_held"] is not None

    assert len(body["greatest_champions"]) > 0
    days = [c["total_days_as_champion"] for c in body["greatest_champions"]]
    assert days == sorted(days, reverse=True)

    assert len(body["records"]) > 0
    kinds = {record["kind"] for record in body["records"]}
    assert kinds == {"positive", "negative"}
    for record in body["records"]:
        values = [entry["value"] for entry in record["entries"]]
        expected_order = sorted(values) if record["key"] == "shortest_reign" else sorted(values, reverse=True)
        assert values == expected_order
        ranks = [entry["rank"] for entry in record["entries"]]
        assert ranks == list(range(1, len(ranks) + 1))


def test_champions_endpoint_is_cacheable(client):
    response = client.get("/champions")
    assert "max-age" in response.headers.get("cache-control", "")


def test_multi_division_champions_list_one_title_win_per_division(client):
    body = client.get("/champions").json()
    record = next(r for r in body["records"] if r["key"] == "multi_division_champions")

    for entry in record["entries"]:
        wins = entry["title_wins"]
        assert len(wins) == entry["value"]
        assert len({win["division"] for win in wins}) == len(wins)
        assert all(win["defenses"] >= 0 and win["reigns_in_division"] >= 1 for win in wins)

    pereira = next(e for e in record["entries"] if e["champion"] == "Alex Pereira")
    middleweight = next(w for w in pereira["title_wins"] if w["division"] == "Middleweight")
    assert (middleweight["event"], middleweight["opponent"], middleweight["method"], middleweight["round"]) == (
        "UFC 281",
        "Israel Adesanya",
        "KO/TKO",
        5,
    )
    light_heavy = next(w for w in pereira["title_wins"] if w["division"] == "Light Heavyweight")
    assert light_heavy["defenses"] == 3


def test_multi_division_champions_carry_every_title_fight(client):
    body = client.get("/champions").json()
    record = next(r for r in body["records"] if r["key"] == "multi_division_champions")

    for entry in record["entries"]:
        fights = entry["title_fights"]
        assert fights, entry["champion"]
        assert [f["date"] for f in fights] == sorted(f["date"] for f in fights)
        # Every belt won shows up as a title fight, so the timeline can never be shorter than the belts won.
        assert sum(f["role"] == "won_title" for f in fights) >= entry["value"]

    penn = next(e for e in record["entries"] if e["champion"] == "B.J. Penn")  # dotted in reigns, "BJ Penn" in fights
    by_date = {f["date"]: f for f in penn["title_fights"]}
    assert by_date["2002-01-11"]["role"] == "challenge"  # first shot, lost to Pulver
    assert by_date["2004-01-31"]["role"] == "won_title"
    assert by_date["2008-05-24"]["label"] == "Title defense #1"
    assert by_date["2010-04-10"]["role"] == "lost_title"
    assert by_date["2010-08-28"]["role"] == "challenge"  # rematch after losing the belt


def test_title_fight_timeline_tells_two_simultaneous_belts_apart(client):
    body = client.get("/champions").json()
    record = next(r for r in body["records"] if r["key"] == "multi_division_champions")
    nunes = next(e for e in record["entries"] if e["champion"] == "Amanda Nunes")
    featherweight = [f for f in nunes["title_fights"] if f["division"] == "Women's Featherweight"]
    assert [f["role"] for f in featherweight] == ["won_title", "defense", "defense"]
    assert featherweight[-1]["label"] == "Title defense #2"


def test_only_the_multi_division_record_carries_title_wins(client):
    body = client.get("/champions").json()
    for record in body["records"]:
        has_wins = any(entry.get("title_wins") for entry in record["entries"])
        assert has_wins == (record["key"] == "multi_division_champions")


def test_current_champions_carry_their_last_fight(client):
    current = client.get("/champions").json()["current_champions"]
    assert current

    # Who holds a belt and who they last fought change with every card, so compare against the fight history itself.
    for reign in current:
        last = reign["last_fight"]
        assert last and last["opponent"] and last["date"], reign["champion"]
        assert last["result"] in {"win", "loss", None}

        latest = get_fights_for_fighter(reign["champion"])[0]
        assert (last["date"], last["opponent"]) == (latest["date"], latest["opponent"]), reign["champion"]

def test_champions_lists_every_reign_oldest_first_within_each_division(client):
    body = client.get("/champions").json()
    reigns = body["reigns"]

    assert len(reigns) > len(body["current_champions"])
    assert {reign["champion"] for reign in body["current_champions"]} <= {reign["champion"] for reign in reigns}
    assert sum(reign["is_current"] for reign in reigns) == len(body["current_champions"])
    for division in {reign["division"] for reign in reigns}:
        dates = [reign["date_won"] for reign in reigns if reign["division"] == division]
        assert dates == sorted(dates)
