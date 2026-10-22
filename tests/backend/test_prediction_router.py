def test_predict_returns_a_winner_with_valid_probabilities(client, two_fighter_names):
    fighter_a, fighter_b = two_fighter_names
    response = client.post("/predict", json={"fighter_a": fighter_a, "fighter_b": fighter_b})

    assert response.status_code == 200
    body = response.json()

    assert body["predicted_winner"] in {fighter_a, fighter_b}
    assert 0.5 <= body["probability"] <= 1.0
    assert abs(body["fighter_a_probability"] + body["fighter_b_probability"] - 1.0) < 1e-6
    assert body["fighter_a_profile"]["name"] == fighter_a
    assert body["fighter_b_profile"]["name"] == fighter_b


def test_predict_includes_shap_driven_main_factors(client, two_fighter_names):
    fighter_a, fighter_b = two_fighter_names
    response = client.post("/predict", json={"fighter_a": fighter_a, "fighter_b": fighter_b})

    body = response.json()
    assert len(body["main_factors"]) > 0
    for factor in body["main_factors"]:
        assert factor["impact"] in {fighter_a, fighter_b}
        assert factor["magnitude"] >= 0


def test_predict_unknown_fighter_returns_404(client, two_fighter_names):
    _, fighter_b = two_fighter_names
    response = client.post("/predict", json={"fighter_a": "Nobody Nonexistent", "fighter_b": fighter_b})
    assert response.status_code == 404


def test_predict_missing_field_returns_422(client):
    response = client.post("/predict", json={"fighter_a": "Someone"})
    assert response.status_code == 422


def test_predict_same_fighter_twice_still_resolves(client, two_fighter_names):
    fighter_a, _ = two_fighter_names
    response = client.post("/predict", json={"fighter_a": fighter_a, "fighter_b": fighter_a})
    assert response.status_code == 200
    body = response.json()
    assert abs(body["fighter_a_probability"] + body["fighter_b_probability"] - 1.0) < 1e-6


def test_upcoming_picks_cover_the_announced_fights(client):
    upcoming = client.get("/events/upcoming").json()
    announced = {
        (event["name"], fight["fighter_1"], fight["fighter_2"])
        for event in upcoming
        for fight in event["fights"]
        if fight["fighter_1"] and fight["fighter_2"]
    }
    response = client.get("/predict/upcoming")
    assert response.status_code == 200
    picks = response.json()

    assert picks
    assert {(pick["event_name"], pick["fighter_1"], pick["fighter_2"]) for pick in picks} <= announced
    for pick in picks:
        assert pick["predicted_winner"] in {pick["fighter_1"], pick["fighter_2"]}
        assert 0.5 <= pick["probability"] <= 1.0
        assert 0.0 <= pick["fighter_1_probability"] <= 1.0
        # The pick is the fighter the probability favors.
        favored = pick["fighter_1"] if pick["fighter_1_probability"] >= 0.5 else pick["fighter_2"]
        assert pick["predicted_winner"] == favored


def test_a_pick_matches_the_full_prediction(client):
    pick = client.get("/predict/upcoming").json()[0]
    full = client.post("/predict", json={"fighter_a": pick["fighter_1"], "fighter_b": pick["fighter_2"]}).json()

    assert full["predicted_winner"] == pick["predicted_winner"]
    assert abs(full["fighter_a_probability"] - pick["fighter_1_probability"]) < 1e-9


def test_predict_says_how_much_data_it_had(client, two_fighter_names):
    fighter_a, fighter_b = two_fighter_names
    body = client.post("/predict", json={"fighter_a": fighter_a, "fighter_b": fighter_b}).json()

    confidence = body["data_confidence"]
    assert confidence["level"] in {"solid", "some_gaps", "thin"}
    assert confidence["label"]
    assert (confidence["level"] == "solid") == (confidence["reasons"] == [])


def _division(client):
    rankings = [c for c in client.get("/rankings").json() if not c["is_p4p"]]
    assert rankings, "the repository ships divisional rankings"
    return rankings[0]["category"]


def test_a_division_matrix_is_symmetric_and_ranks_the_round_robin(client):
    category = _division(client)
    response = client.get("/predict/division", params={"category": category, "top": 5})
    assert response.status_code == 200
    body = response.json()

    names, matrix = body["fighters"], body["matrix"]
    assert 2 <= len(names) <= 5 and len(matrix) == len(names)
    for i in range(len(names)):
        assert matrix[i][i] is None
        for j in range(len(names)):
            if i != j:
                assert abs(matrix[i][j] + matrix[j][i] - 1.0) < 1e-9  # one answer whichever fighter is listed first
    standings = body["round_robin"]
    assert {row["fighter"] for row in standings} == set(names)
    averages = [row["average_win_probability"] for row in standings]
    assert averages == sorted(averages, reverse=True)
    assert abs(sum(row["expected_wins"] for row in standings) - len(names) * (len(names) - 1) / 2) < 1e-6  # every fight has one winner


def test_a_division_matrix_rejects_an_unknown_division_and_a_bad_size(client):
    assert client.get("/predict/division", params={"category": "Nonexistent Weight"}).status_code == 404
    assert client.get("/predict/division", params={"category": _division(client), "top": 1}).status_code == 422
    assert client.get("/predict/division", params={"category": _division(client), "top": 50}).status_code == 422
