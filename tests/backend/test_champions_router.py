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
