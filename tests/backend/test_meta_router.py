def test_root_lists_available_endpoints(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["health"] == "/health"
    assert body["predict"] == "/predict"


def test_health_reports_model_and_fighters_loaded(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["fighters_loaded"] > 0
    assert body["fights_tracked"] > 0
    assert body["latest_fight_date"]


def test_model_info_reports_metrics_and_features(client):
    response = client.get("/model-info")
    assert response.status_code == 200
    body = response.json()
    assert body["feature_count"] == len(body["features"])
    assert 0.0 <= body["metrics"]["accuracy"] <= 1.0
    assert "dummy_most_frequent" in body["baseline_metrics"]


def test_responses_include_security_headers(client):
    response = client.get("/health")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_data_info_reports_real_counts_and_sources(client):
    response = client.get("/data-info")
    assert response.status_code == 200
    body = response.json()

    assert body["fighters_count"] > 1000
    assert body["events_count"] > 0
    assert body["fights_count"] > 0
    assert set(body["sources"]) == {"ufcstats.com", "ufc.com"}

    import datetime

    assert datetime.date.fromisoformat(body["last_updated"]) <= datetime.date.today()


def test_model_info_sends_the_measured_result_and_says_the_reported_one_could_not_be_reproduced(client):
    body = client.get("/model-info").json()
    measured = body["recent_evaluation"]
    assert measured["fights"] > 1000 and 0.5 < measured["accuracy"] < 0.7  # what the model really does on recent fights
    assert f"Measured on {measured['fights']:,} recent fights" in body["metrics_note"]
    assert "could not be reproduced" in body["metrics_note"] and f"{body['metrics']['accuracy']:.1%}" in body["metrics_note"]
    assert any("could not be reproduced" in item for item in body["limitations"])
    assert any("overconfident" in item for item in body["limitations"])
    assert body["limitations"][-1].startswith("This is a personal project")  # the disclaimer stays last
