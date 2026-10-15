from scripts import validate_data


def test_read_rows_parses_quoted_fields():
    rows = validate_data.read_rows('a,b\n"x, y",z\n')
    assert rows == [["a", "b"], ["x, y", "z"]]


def test_validate_flags_missing_files(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    problems = validate_data.validate()
    assert any("events.csv: file is missing" in p for p in problems)


def write(path, text):
    path.write_text(text, encoding="utf-8")


def test_champion_mismatch_names_the_division_where_rankings_and_reigns_disagree(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    write(
        tmp_path / "rankings.csv",
        "category,is_p4p,rank,fighter,rank_change,athlete_url\n"
        "Flyweight,False,0,New Champ,,/a\n"
        "Bantamweight,False,0,Peter O'Malley,,/b\n"
        "Bantamweight,False,1,Someone Else,,/c\n"
        "Pound-for-Pound (Men's),True,0,Whoever,,/d\n",
    )
    write(
        tmp_path / "title_reigns.csv",
        "division,title_type,champion,is_current\n"
        "Flyweight,undisputed,Old Champ,True\n"
        "Bantamweight,undisputed,Peter O'Malley,True\n"
        "Bantamweight,interim,Interim Guy,True\n",
    )

    notes = validate_data.champion_mismatches()
    assert notes == ["Flyweight: rankings say New Champ, title_reigns.csv says Old Champ"]


def test_champion_mismatch_ignores_spelling_and_a_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_data, "RAW_DIR", tmp_path)
    assert validate_data.champion_mismatches() == []  # nothing to compare

    write(tmp_path / "rankings.csv", "category,is_p4p,rank,fighter,rank_change,athlete_url\nFlyweight,False,0,Joshua  Van,,/a\n")
    write(tmp_path / "title_reigns.csv", "division,title_type,champion,is_current\nFlyweight,undisputed,joshua van,True\n")
    assert validate_data.champion_mismatches() == []
