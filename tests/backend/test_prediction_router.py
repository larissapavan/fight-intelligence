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
