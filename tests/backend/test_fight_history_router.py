def test_head_to_head_counts_real_meetings(client, two_fighter_names):
    fighter_a, fighter_b = two_fighter_names
    response = client.get("/head-to-head", params={"fighter_a": fighter_a, "fighter_b": fighter_b})
    assert response.status_code == 200
    body = response.json()

    assert body["fighter_a"] == fighter_a
    assert body["fighter_b"] == fighter_b
    total = body["fighter_a_wins"] + body["fighter_b_wins"] + body["no_contests"]
    assert total == len(body["meetings"])


def test_head_to_head_unknown_fighter_returns_404(client, two_fighter_names):
    _, fighter_b = two_fighter_names
    response = client.get("/head-to-head", params={"fighter_a": "Nobody Nonexistent", "fighter_b": fighter_b})
    assert response.status_code == 404


def test_fighter_performance_totals_are_consistent(client, two_fighter_names):
    fighter_a, _ = two_fighter_names
    response = client.get(f"/fighters/{fighter_a}/performance")
    assert response.status_code == 200
    body = response.json()

    assert body["fighter"] == fighter_a
    assert body["wins"] + body["losses"] <= body["total_fights"]
    assert sum(body["method_breakdown"].values()) == body["wins"]
    assert len(body["last_performances"]) <= 5


def test_fighter_performance_unknown_fighter_returns_404(client):
    response = client.get("/fighters/Nobody Nonexistent/performance")
    assert response.status_code == 404
