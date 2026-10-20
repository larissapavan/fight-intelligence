from scripts.scrape_rankings import GROUPS_EXPECTED, rankings_problem


def test_rankings_problem_rejects_a_partial_page():
    assert "zero" in rankings_problem([])
    assert "categories" in rankings_problem([{"category": "Flyweight", "fighter": "A"}])

    full = [{"category": f"Division {index}", "fighter": "A"} for index in range(GROUPS_EXPECTED)]
    assert rankings_problem(full) is None
    assert "dropped" in rankings_problem(full, previous_rows=len(full) * 2)
    full[0] = {**full[0], "fighter": "  "}
    assert "fighter" in rankings_problem(full)


def test_ranking_changes_report_moves_entries_exits_and_a_new_champion():
    from scripts.scrape_rankings import ranking_changes

    def row(category, rank, fighter):
        return {"category": category, "rank": rank, "fighter": fighter}

    old = [row("Flyweight", 0, "Champ"), row("Flyweight", 1, "Second"), row("Flyweight", 2, "Third"), row("Flyweight", 3, "Gone")]
    new = [row("Flyweight", 0, "Second"), row("Flyweight", 1, "Champ"), row("Flyweight", 2, "Third"), row("Flyweight", 3, "Fresh")]
    assert ranking_changes(old, new) == [
        "Flyweight: Second is now champion",
        "Flyweight: Champ #C -> #1",
        "Flyweight: Fresh enters at #3",
        "Flyweight: Gone left the rankings",
    ]
    assert ranking_changes(old, old) == []
