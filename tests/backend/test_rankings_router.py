def test_rankings_returns_p4p_and_divisions(client):
    response = client.get("/rankings")
    assert response.status_code == 200
    categories = response.json()

    names = {c["category"] for c in categories}
    assert "Pound-for-Pound (Men's)" in names
    assert "Heavyweight" in names
    assert len(categories) >= 10


def test_ranking_entries_are_ordered_and_enriched(client):
    response = client.get("/rankings")
    categories = response.json()

    heavyweight = next(c for c in categories if c["category"] == "Heavyweight")
    ranks = [entry["rank"] for entry in heavyweight["entries"]]
    assert ranks == sorted(ranks)
    assert ranks[0] == 0  # champion

    with_win_rate = [entry for entry in heavyweight["entries"] if entry["win_rate"] is not None]
    assert len(with_win_rate) > 0
    for entry in with_win_rate:
        assert 0.0 <= entry["win_rate"] <= 1.0


def test_p4p_has_no_duplicate_champion_row(client):
    response = client.get("/rankings")
    categories = response.json()

    p4p = next(c for c in categories if c["category"] == "Pound-for-Pound (Men's)")
    fighters = [entry["fighter"] for entry in p4p["entries"]]
    assert len(fighters) == len(set(fighters))
    assert p4p["entries"][0]["rank"] == 1


def test_rankings_response_is_cacheable(client):
    response = client.get("/rankings")
    assert response.headers.get("cache-control") == "public, max-age=1800"
