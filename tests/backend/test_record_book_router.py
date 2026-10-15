def test_record_book_groups_every_stat_by_category(client):
    response = client.get("/record-book")
    assert response.status_code == 200
    body = response.json()

    assert [category["name"] for category in body["categories"]] == ["Fights", "Time", "Striking", "Grappling"]
    stats = {stat["key"]: stat for category in body["categories"] for stat in category["stats"]}
    assert len(stats) >= 30
    assert body["source_url"].startswith("https://statleaders.ufc.com")
    assert body["updated"]


def test_leaders_are_ranked_and_linked_to_our_profiles(client):
    stats = {stat["key"]: stat for category in client.get("/record-book").json()["categories"] for stat in category["stats"]}

    fights = stats["TotalFights"]
    assert fights["title"] == "Total Fights"
    leaders = fights["leaders"]
    assert leaders[0]["rank"] == 1
    # Career leaders change with every card: check the table is ordered, not who tops it.
    ranks = [leader["rank"] for leader in leaders]
    assert ranks == sorted(ranks)
    values = [int(leader["value"].replace(",", "")) for leader in leaders]
    assert values == sorted(values, reverse=True)
    assert all(leader["value"] for leader in leaders)
    # Most all-time leaders have a profile in our catalog; those that do carry its exact name.
    assert sum(1 for leader in leaders if leader["profile_name"]) >= len(leaders) // 2

    # Percent stats keep the page's note about who qualifies.
    assert "Minimum 5 UFC Fights" in stats["SigStrikesAccuracy"]["note"]
    assert stats["SigStrikesAccuracy"]["unit"] == "Percent"
