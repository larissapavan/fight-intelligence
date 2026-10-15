import pandas as pd

from backend.app.services.bmf_service import BMF_FIGHTS_SOURCE_PATH


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


def test_cors_allows_the_new_vercel_site_and_its_previews(client):
    for origin in ("https://fight-intelligence.vercel.app", "https://fight-intelligence-git-main-larissapavan.vercel.app"):
        response = client.get("/fighters", headers={"Origin": origin})
        assert response.headers.get("access-control-allow-origin") == origin


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


def test_every_fighter_has_a_ufc_status_and_former_ones_carry_roster_dates(client):
    fighters = client.get("/fighters").json()
    assert {fighter["ufc_status"] for fighter in fighters} <= {"active", "former", "never"}

    former = [fighter for fighter in fighters if fighter["ufc_status"] == "former" and fighter["roster_url"]]
    assert len(former) > 1500
    assert all(fighter["ufc_debut"] and fighter["ufc_last_fight"] for fighter in former)

    by_name = {fighter["name"]: fighter for fighter in fighters}
    assert by_name["Khabib Nurmagomedov"]["ufc_status"] == "former"
    assert by_name["Khabib Nurmagomedov"]["ufc_last_fight"] == "2020-10-24"
    # Retired from the UFC even though the last fight is recent: roster.watch says so.
    assert by_name["Jon Jones"]["is_active"] is False
    # Never fought in the UFC: no status of "former" and no fights.
    assert any(fighter["ufc_status"] == "never" for fighter in fighters)


def test_nationalities_badges_and_the_roster_status_come_from_roster_watch(client):
    by_name = {fighter["name"]: fighter for fighter in client.get("/fighters").json()}

    topuria = by_name["Ilia Topuria"]
    assert [item["code"] for item in topuria["nationalities"]] == ["ge", "es"]
    assert topuria["country_code"] == "ge"  # the first nationality is the one he represents

    tsarukyan = by_name["Arman Tsarukyan"]
    assert tsarukyan["country_code"] == "am"
    assert [item["name"] for item in tsarukyan["nationalities"]] == ["Armenia", "Russia"]

    assert "bmf" in by_name["Justin Gaethje"]["badges"]
    assert "dwcs" in by_name["Carlos Ulberg"]["badges"]
    assert {"goat", "hof"} <= set(by_name["Georges St-Pierre"]["badges"])
    assert by_name["Georges St-Pierre"]["ufc_status"] == "former"


def test_the_winner_of_the_latest_bmf_fight_is_the_current_bmf_champion(client):
    by_name = {fighter["name"]: fighter for fighter in client.get("/fighters").json()}

    # Read the BMF fights straight from their file so the expectation moves on its own after each new BMF fight.
    fights = pd.read_csv(BMF_FIGHTS_SOURCE_PATH, keep_default_na=False)
    decided = fights[fights["winner"].astype(str).str.strip().ne("")].sort_values("date")
    current = decided.iloc[-1]["winner"]
    earlier = {winner for winner in decided["winner"] if winner != current}

    assert by_name[current]["badges"][0] == "bmf_current"
    assert "bmf" not in by_name[current]["badges"]
    # Earlier champions keep a plain "bmf" badge.
    for name in earlier:
        assert "bmf" in by_name[name]["badges"], name
        assert "bmf_current" not in by_name[name]["badges"], name


def test_ufc_only_leaves_out_fighters_who_never_fought_in_the_ufc(client):
    everyone = client.get("/fighters").json()
    ufc_only = client.get("/fighters", params={"ufc_only": True})

    assert ufc_only.status_code == 200
    listed = ufc_only.json()
    assert listed and len(listed) < len(everyone)
    assert all(fighter["ufc_status"] in {"active", "former"} for fighter in listed)
    assert int(ufc_only.headers["X-Total-Count"]) == len(listed)
    # Nobody who fought in the UFC goes missing.
    assert {f["name"] for f in everyone if f["ufc_status"] != "never"} == {f["name"] for f in listed}


def test_health_counts_only_the_fighters_the_site_shows(client):
    shown = client.get("/fighters", params={"ufc_only": True}).json()
    assert client.get("/health").json()["fighters_loaded"] == len(shown)
