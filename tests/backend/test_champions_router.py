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


def test_only_the_multi_division_record_carries_title_wins(client):
    body = client.get("/champions").json()
    for record in body["records"]:
        has_wins = any(entry.get("title_wins") for entry in record["entries"])
        assert has_wins == (record["key"] == "multi_division_champions")
