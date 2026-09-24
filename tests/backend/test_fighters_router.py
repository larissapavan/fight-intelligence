def test_fighters_returns_full_catalog(client):
    response = client.get("/fighters")
    assert response.status_code == 200
    fighters = response.json()
    assert len(fighters) > 1000

    first = fighters[0]
    assert "name" in first
    assert "wins" in first
    assert "stance" in first


def test_fighters_response_is_cacheable(client):
    response = client.get("/fighters")
    assert response.headers.get("cache-control") == "public, max-age=300"
