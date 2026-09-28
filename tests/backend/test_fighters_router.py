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


def test_fighters_reports_total_count_header(client):
    response = client.get("/fighters")
    total = int(response.headers["x-total-count"])
    assert total == len(response.json())
    assert total > 1000


def test_fighters_exposes_total_count_header_cross_origin(client):
    response = client.get("/fighters", headers={"Origin": "https://ufcfightpredictor.vercel.app"})
    assert "x-total-count" in response.headers.get("access-control-expose-headers", "").lower()


def test_fighters_supports_limit_and_offset(client):
    total = int(client.get("/fighters").headers["x-total-count"])

    first_page = client.get("/fighters", params={"limit": 10}).json()
    assert len(first_page) == 10

    second_page = client.get("/fighters", params={"limit": 10, "offset": 10}).json()
    assert len(second_page) == 10
    assert {f["name"] for f in first_page}.isdisjoint({f["name"] for f in second_page})

    assert int(client.get("/fighters").headers["x-total-count"]) == total


def test_similar_fighters_returns_ranked_matches(client, two_fighter_names):
    fighter_a, _ = two_fighter_names
    response = client.get(f"/fighters/{fighter_a}/similar")
    assert response.status_code == 200
    body = response.json()

    assert 1 <= len(body) <= 5
    assert all(entry["name"] != fighter_a for entry in body)
    similarities = [entry["similarity"] for entry in body]
    assert similarities == sorted(similarities, reverse=True)
    assert all(0.0 < score <= 1.0 for score in similarities)


def test_similar_fighters_respects_limit(client, two_fighter_names):
    fighter_a, _ = two_fighter_names
    response = client.get(f"/fighters/{fighter_a}/similar", params={"limit": 3})
    assert len(response.json()) == 3


def test_similar_fighters_unknown_fighter_returns_404(client):
    response = client.get("/fighters/Nobody Nonexistent/similar")
    assert response.status_code == 404


def test_similar_fighters_covers_entire_catalog(client):
    """Regression guard: the similarity search must resolve for every fighter, not
    silently fail for a subset (e.g. one with mostly-missing physical stats).
    """
    fighters = client.get("/fighters").json()
    sample = fighters[::200]  # spot-check across the catalog instead of all ~4500 (slow)

    failures = []
    for fighter in sample:
        response = client.get(f"/fighters/{fighter['name']}/similar")
        if response.status_code != 200 or len(response.json()) == 0:
            failures.append((fighter["name"], response.status_code))

    assert not failures, f"{len(failures)} fighters failed /similar: {failures[:10]}"
